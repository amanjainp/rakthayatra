import { ChannelModel, Channel, connect } from 'amqplib';
import { env } from '../config/env';
import logger from '../config/logger';
import { InternalServerError } from '../errors/app-error';
import { metricsService } from './metrics.service';

export interface QueueBinding {
  queueName: string;
  routingKeyPattern: string;
}

export class RabbitMQService {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private isMockMode = false;

  // Mock broker structure
  private mockConsumers = new Map<string, Array<(msg: any) => Promise<void>>>();

  public readonly EXCHANGE_NAME = 'lifelink.topic';
  public readonly DLX_EXCHANGE_NAME = 'lifelink.dlx';

  public readonly BINDINGS: QueueBinding[] = [
    { queueName: 'lifelink.queue.notification', routingKeyPattern: 'notification.#' },
    { queueName: 'lifelink.queue.audit', routingKeyPattern: 'audit.#' },
    { queueName: 'lifelink.queue.email', routingKeyPattern: 'email.#' },
    { queueName: 'lifelink.queue.sms', routingKeyPattern: 'sms.#' },
  ];

  constructor() {
    const amqpUrl = env.RABBITMQ_URL || '';

    if (!amqpUrl) {
      logger.warn('RABBITMQ_URL not configured. RabbitMQService is running in MOCK mode.');
      this.isMockMode = true;
    } else {
      this.initializeLiveConnection(amqpUrl);
    }
  }

  public getMockMode(): boolean {
    return this.isMockMode;
  }

  private async initializeLiveConnection(url: string) {
    try {
      this.connection = await connect(url);
      this.channel = await this.connection.createChannel();

      // 1. Assert exchanges
      await this.channel.assertExchange(this.EXCHANGE_NAME, 'topic', { durable: true });
      await this.channel.assertExchange(this.DLX_EXCHANGE_NAME, 'topic', { durable: true });

      // 2. Assert and bind queues with DLQ settings
      for (const binding of this.BINDINGS) {
        // Assert DLQ queue
        const dlqName = `dlq.${binding.queueName}`;
        await this.channel.assertQueue(dlqName, { durable: true });
        await this.channel.bindQueue(dlqName, this.DLX_EXCHANGE_NAME, dlqName);

        // Assert main queue bound to DLX exchange on failure
        await this.channel.assertQueue(binding.queueName, {
          durable: true,
          deadLetterExchange: this.DLX_EXCHANGE_NAME,
          deadLetterRoutingKey: dlqName,
        });

        await this.channel.bindQueue(binding.queueName, this.EXCHANGE_NAME, binding.routingKeyPattern);
      }

      logger.info('RabbitMQ connection pool and exchanges created successfully.');
    } catch (error: any) {
      logger.error(`RabbitMQ live broker initialization failed: ${error.message}. Reverting to MOCK mode.`);
      this.isMockMode = true;
    }
  }

  /**
   * Pings the message broker to evaluate connectivity.
   */
  async healthCheck(): Promise<boolean> {
    if (this.isMockMode) {
      return true;
    }
    if (!this.connection) {
      return false;
    }
    try {
      // Create a temporary channel to check status
      const tempChannel = await this.connection.createChannel();
      await tempChannel.close();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Returns message count in the queue if online.
   */
  async getQueueDepth(queueName: string): Promise<number> {
    if (this.isMockMode || !this.channel) {
      return 0;
    }
    try {
      const qInfo = await this.channel.checkQueue(queueName);
      return qInfo.messageCount;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Publishes a message payload to the Topic Exchange.
   */
  async publish(routingKey: string, message: any): Promise<void> {
    metricsService.recordRabbitMQPublish();
    const payloadBuffer = Buffer.from(JSON.stringify(message));

    if (this.isMockMode) {
      logger.debug(`[MOCK] Publishing message to exchange "${this.EXCHANGE_NAME}" with routingKey "${routingKey}"`);
      
      // Map message to bound queues asynchronously
      for (const binding of this.BINDINGS) {
        if (this.matchesRoutingKeyPattern(routingKey, binding.routingKeyPattern)) {
          const consumers = this.mockConsumers.get(binding.queueName) || [];
          for (const callback of consumers) {
            // Trigger callback in the background
            setImmediate(async () => {
              try {
                metricsService.recordRabbitMQConsume();
                await callback(message);
              } catch (error: any) {
                logger.error(`[MOCK DLQ] Message failed processing on queue "${binding.queueName}". Sent to DLQ "dlq.${binding.queueName}": ${error.message}`);
              }
            });
          }
        }
      }
      return;
    }

    if (!this.channel) {
      throw new InternalServerError('RabbitMQ channel is not initialized.');
    }

    try {
      const published = this.channel.publish(this.EXCHANGE_NAME, routingKey, payloadBuffer, {
        persistent: true,
      });

      if (!published) {
        logger.warn(`RabbitMQ channel buffer full. Publish failed for key "${routingKey}"`);
        throw new Error('Message buffer capacity reached.');
      }
      logger.debug(`Message published to RabbitMQ exchange. Key: ${routingKey}`);
    } catch (error: any) {
      logger.error(`RabbitMQ publish failed for routingKey "${routingKey}": ${error.message}`);
      throw new InternalServerError('Failed to publish message to broker exchange.');
    }
  }

  /**
   * Subscribes a background worker callback to process messages in a queue.
   */
  async consume(queueName: string, callback: (msg: any) => Promise<void>): Promise<void> {
    if (this.isMockMode) {
      const consumers = this.mockConsumers.get(queueName) || [];
      consumers.push(callback);
      this.mockConsumers.set(queueName, consumers);
      logger.debug(`[MOCK] Consumer registered successfully on queue "${queueName}"`);
      return;
    }

    if (!this.channel) {
      throw new InternalServerError('RabbitMQ channel is not initialized.');
    }

    try {
      await this.channel.consume(queueName, async (amqpMsg) => {
        if (!amqpMsg) return;

        try {
          metricsService.recordRabbitMQConsume();
          const content = JSON.parse(amqpMsg.content.toString());
          await callback(content);
          this.channel!.ack(amqpMsg); // Acknowledge success
        } catch (error: any) {
          logger.warn(`Message consumption error on queue "${queueName}". Releasing to DLQ: ${error.message}`);
          // Send to DLQ (nack with requeue=false)
          this.channel!.nack(amqpMsg, false, false);
        }
      });
      logger.info(`Consumer successfully registered on queue: ${queueName}`);
    } catch (error: any) {
      logger.error(`Failed to register consumer on queue "${queueName}": ${error.message}`);
      throw new InternalServerError('Failed to bind subscriber to queue.');
    }
  }

  /**
   * Evaluates routingKey values against AMQP patterns (supporting '.' separators and '#' wildcards).
   */
  private matchesRoutingKeyPattern(routingKey: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '[^.]+')
      .replace(/\\\.\#/g, '(\\..*)?') // Match trailing .# as optional dot-delimited group
      .replace(/#/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(routingKey);
  }

  /**
   * Closes active connections.
   */
  async close(): Promise<void> {
    if (this.isMockMode) return;
    try {
      await this.channel?.close();
      await this.connection?.close();
      logger.info('RabbitMQ connection closed.');
    } catch (error) {
      logger.error('Failed to close RabbitMQ connection.');
    }
  }
}

export const rabbitMQService = new RabbitMQService();

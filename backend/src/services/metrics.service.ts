import client from 'prom-client';
import logger from '../config/logger';

export class MetricsService {
  private registry: client.Registry;

  // HTTP Metrics
  private httpRequestCounter: client.Counter;
  private httpRequestDurationHistogram: client.Histogram;
  private activeRequestsGauge: client.Gauge;

  // Database Metrics
  private prismaQueryCounter: client.Counter;
  private prismaQueryDurationHistogram: client.Histogram;
  private prismaActiveConnectionsGauge: client.Gauge;
  private prismaQueryFailureCounter: client.Counter;

  // Redis Metrics
  private redisCacheHitCounter: client.Counter;
  private redisCacheMissCounter: client.Counter;
  private redisCacheOperationsCounter: client.Counter;
  private redisTTLExpirationCounter: client.Counter;

  // RabbitMQ Metrics
  private rabbitmqPublishCounter: client.Counter;
  private rabbitmqConsumeCounter: client.Counter;
  private rabbitmqQueueDepthGauge: client.Gauge;
  private rabbitmqDLQSizeGauge: client.Gauge;

  // Authentication Metrics
  private authLoginSuccessCounter: client.Counter;
  private authLoginFailureCounter: client.Counter;
  private authOTPVerificationCounter: client.Counter;
  private authJWTRefreshCounter: client.Counter;

  // Business Metrics
  private businessBloodRequestsCounter: client.Counter;
  private businessDonationsCompletedCounter: client.Counter;
  private businessEmergencyRequestsCounter: client.Counter;
  private businessInventoryReservationsCounter: client.Counter;
  private businessCampRegistrationsCounter: client.Counter;
  private businessNotificationsSentCounter: client.Counter;

  constructor() {
    // 1. Initialize Registry
    this.registry = new client.Registry();

    // 2. Enable Default System & Process Metrics (CPU, Memory, Event Loop, Uptime)
    client.collectDefaultMetrics({ register: this.registry, prefix: 'lifelink_node_' });

    // 3. Define HTTP Metrics
    this.httpRequestCounter = new client.Counter({
      name: 'lifelink_http_requests_total',
      help: 'Total number of HTTP requests processed',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDurationHistogram = new client.Histogram({
      name: 'lifelink_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.activeRequestsGauge = new client.Gauge({
      name: 'lifelink_http_active_requests_total',
      help: 'Total number of currently active HTTP requests',
      registers: [this.registry],
    });

    // 4. Define Database Metrics
    this.prismaQueryCounter = new client.Counter({
      name: 'lifelink_prisma_queries_total',
      help: 'Total number of Prisma queries executed',
      registers: [this.registry],
    });

    this.prismaQueryDurationHistogram = new client.Histogram({
      name: 'lifelink_prisma_query_duration_seconds',
      help: 'Prisma query duration in seconds',
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.prismaActiveConnectionsGauge = new client.Gauge({
      name: 'lifelink_prisma_active_connections',
      help: 'Estimated number of active database connection sessions',
      registers: [this.registry],
    });

    this.prismaQueryFailureCounter = new client.Counter({
      name: 'lifelink_prisma_query_failures_total',
      help: 'Total number of failed Prisma queries',
      registers: [this.registry],
    });

    // 5. Define Redis Metrics
    this.redisCacheHitCounter = new client.Counter({
      name: 'lifelink_redis_cache_hits_total',
      help: 'Total number of cache get operation hits',
      registers: [this.registry],
    });

    this.redisCacheMissCounter = new client.Counter({
      name: 'lifelink_redis_cache_misses_total',
      help: 'Total number of cache get operation misses',
      registers: [this.registry],
    });

    this.redisCacheOperationsCounter = new client.Counter({
      name: 'lifelink_redis_cache_operations_total',
      help: 'Total number of cache operation queries executed',
      registers: [this.registry],
    });

    this.redisTTLExpirationCounter = new client.Counter({
      name: 'lifelink_redis_ttl_expirations_total',
      help: 'Total number of custom TTL expired keys pruned',
      registers: [this.registry],
    });

    // 6. Define RabbitMQ Metrics
    this.rabbitmqPublishCounter = new client.Counter({
      name: 'lifelink_rabbitmq_messages_published_total',
      help: 'Total number of queue messages published to topic exchange',
      registers: [this.registry],
    });

    this.rabbitmqConsumeCounter = new client.Counter({
      name: 'lifelink_rabbitmq_messages_consumed_total',
      help: 'Total number of queue messages consumed by background workers',
      registers: [this.registry],
    });

    this.rabbitmqQueueDepthGauge = new client.Gauge({
      name: 'lifelink_rabbitmq_queue_depth',
      help: 'Total messages currently in the RabbitMQ queues',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.rabbitmqDLQSizeGauge = new client.Gauge({
      name: 'lifelink_rabbitmq_dlq_size',
      help: 'Total messages currently in the RabbitMQ Dead Letter Queues',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    // 7. Define Authentication Metrics
    this.authLoginSuccessCounter = new client.Counter({
      name: 'lifelink_auth_logins_success_total',
      help: 'Total number of successful login actions',
      registers: [this.registry],
    });

    this.authLoginFailureCounter = new client.Counter({
      name: 'lifelink_auth_logins_failed_total',
      help: 'Total number of failed login actions',
      registers: [this.registry],
    });

    this.authOTPVerificationCounter = new client.Counter({
      name: 'lifelink_auth_otp_verifications_total',
      help: 'Total number of OTP verification attempts',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.authJWTRefreshCounter = new client.Counter({
      name: 'lifelink_auth_jwt_refreshes_total',
      help: 'Total number of JWT token rotate refreshes',
      labelNames: ['status'],
      registers: [this.registry],
    });

    // 8. Define Business Metrics
    this.businessBloodRequestsCounter = new client.Counter({
      name: 'lifelink_business_blood_requests_created_total',
      help: 'Total number of blood requests created',
      labelNames: ['urgency'],
      registers: [this.registry],
    });

    this.businessDonationsCompletedCounter = new client.Counter({
      name: 'lifelink_business_donations_completed_total',
      help: 'Total number of blood donations completed successfully',
      registers: [this.registry],
    });

    this.businessEmergencyRequestsCounter = new client.Counter({
      name: 'lifelink_business_emergency_requests_total',
      help: 'Total number of emergency request actions triggered',
      registers: [this.registry],
    });

    this.businessInventoryReservationsCounter = new client.Counter({
      name: 'lifelink_business_inventory_reservations_total',
      help: 'Total number of inventory batch reservations completed',
      registers: [this.registry],
    });

    this.businessCampRegistrationsCounter = new client.Counter({
      name: 'lifelink_business_camp_registrations_total',
      help: 'Total number of users registered to donation camps',
      labelNames: ['role'],
      registers: [this.registry],
    });

    this.businessNotificationsSentCounter = new client.Counter({
      name: 'lifelink_business_notifications_sent_total',
      help: 'Total push and system notification dispatches',
      labelNames: ['type'],
      registers: [this.registry],
    });

    logger.info('Observability prom-client metrics registered successfully.');
  }

  // HTTP Recording Helper APIs
  recordHttpRequest(method: string, route: string, status: number, durationSeconds: number) {
    const cleanRoute = route || '/';
    this.httpRequestCounter.inc({ method, route: cleanRoute, status: status.toString() });
    this.httpRequestDurationHistogram.observe({ method, route: cleanRoute, status: status.toString() }, durationSeconds);
  }

  incrementActiveRequests() {
    this.activeRequestsGauge.inc();
  }

  decrementActiveRequests() {
    this.activeRequestsGauge.dec();
  }

  // Database Helpers
  recordPrismaQuery(durationMs: number) {
    this.prismaQueryCounter.inc();
    this.prismaQueryDurationHistogram.observe(durationMs / 1000);
  }

  recordPrismaFailure() {
    this.prismaQueryFailureCounter.inc();
  }

  setPrismaActiveConnections(connectionsCount: number) {
    this.prismaActiveConnectionsGauge.set(connectionsCount);
  }

  // Redis Helpers
  recordCacheHit() {
    this.redisCacheHitCounter.inc();
    this.redisCacheOperationsCounter.inc();
  }

  recordCacheMiss() {
    this.redisCacheMissCounter.inc();
    this.redisCacheOperationsCounter.inc();
  }

  recordCacheOp() {
    this.redisCacheOperationsCounter.inc();
  }

  recordTTLExpiration() {
    this.redisTTLExpirationCounter.inc();
  }

  // RabbitMQ Helpers
  recordRabbitMQPublish() {
    this.rabbitmqPublishCounter.inc();
  }

  recordRabbitMQConsume() {
    this.rabbitmqConsumeCounter.inc();
  }

  setQueueDepth(queue: string, count: number) {
    this.rabbitmqQueueDepthGauge.set({ queue }, count);
  }

  setDLQSize(queue: string, count: number) {
    this.rabbitmqDLQSizeGauge.set({ queue }, count);
  }

  // Auth Helpers
  recordLoginSuccess() {
    this.authLoginSuccessCounter.inc();
  }

  recordLoginFailure() {
    this.authLoginFailureCounter.inc();
  }

  recordOTPVerification(success: boolean) {
    this.authOTPVerificationCounter.inc({ status: success ? 'success' : 'failure' });
  }

  recordJWTRefresh(success: boolean) {
    this.authJWTRefreshCounter.inc({ status: success ? 'success' : 'failure' });
  }

  // Business Helpers
  recordBloodRequest(urgency: string) {
    this.businessBloodRequestsCounter.inc({ urgency });
  }

  recordDonationCompleted() {
    this.businessDonationsCompletedCounter.inc();
  }

  recordEmergencyRequest() {
    this.businessEmergencyRequestsCounter.inc();
  }

  recordInventoryReservation() {
    this.businessInventoryReservationsCounter.inc();
  }

  recordCampRegistration(role: 'donor' | 'volunteer' | 'hospital') {
    this.businessCampRegistrationsCounter.inc({ role });
  }

  recordNotificationSent(type: string) {
    this.businessNotificationsSentCounter.inc({ type });
  }

  // Fetch Output API
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

export const metricsService = new MetricsService();

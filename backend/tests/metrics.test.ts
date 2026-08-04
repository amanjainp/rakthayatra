import request from 'supertest';
import app from '../src/app';
import { metricsService } from '../src/services/metrics.service';

describe('Observability Metrics Module Tests', () => {
  beforeEach(async () => {
    // Perform a dummy request to populate HTTP metrics
    await request(app).get('/health');
  });

  describe('GET /metrics Endpoint', () => {
    it('should retrieve Prometheus format metrics successfully', async () => {
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('lifelink_http_requests_total');
      expect(response.text).toContain('lifelink_node_process_cpu_user_seconds_total');
    });
  });

  describe('MetricsService Unit Actions', () => {
    it('should increment active requests counter correctly', async () => {
      metricsService.incrementActiveRequests();
      let metrics = await metricsService.getMetrics();
      expect(metrics).toContain('lifelink_http_active_requests_total 1');

      metricsService.decrementActiveRequests();
      metrics = await metricsService.getMetrics();
      expect(metrics).toContain('lifelink_http_active_requests_total 0');
    });

    it('should track prisma metrics correctly', async () => {
      metricsService.recordPrismaQuery(150); // 150ms
      metricsService.recordPrismaFailure();
      metricsService.setPrismaActiveConnections(5);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('lifelink_prisma_queries_total 1');
      expect(metrics).toContain('lifelink_prisma_query_failures_total 1');
      expect(metrics).toContain('lifelink_prisma_active_connections 5');
    });

    it('should record Redis cache statistics', async () => {
      metricsService.recordCacheHit();
      metricsService.recordCacheMiss();
      metricsService.recordCacheOp();
      metricsService.recordTTLExpiration();

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('lifelink_redis_cache_hits_total 1');
      expect(metrics).toContain('lifelink_redis_cache_misses_total 1');
      expect(metrics).toContain('lifelink_redis_ttl_expirations_total 1');
    });

    it('should track RabbitMQ message metrics', async () => {
      metricsService.recordRabbitMQPublish();
      metricsService.recordRabbitMQConsume();
      metricsService.setQueueDepth('lifelink.queue.notification', 10);
      metricsService.setDLQSize('lifelink.queue.notification', 2);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('lifelink_rabbitmq_messages_published_total 1');
      expect(metrics).toContain('lifelink_rabbitmq_messages_consumed_total 1');
      expect(metrics).toContain('lifelink_rabbitmq_queue_depth{queue="lifelink.queue.notification"} 10');
      expect(metrics).toContain('lifelink_rabbitmq_dlq_size{queue="lifelink.queue.notification"} 2');
    });

    it('should record auth event transactions', async () => {
      metricsService.recordLoginSuccess();
      metricsService.recordLoginFailure();
      metricsService.recordOTPVerification(true);
      metricsService.recordJWTRefresh(false);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('lifelink_auth_logins_success_total 1');
      expect(metrics).toContain('lifelink_auth_logins_failed_total 1');
      expect(metrics).toContain('lifelink_auth_otp_verifications_total{status="success"} 1');
      expect(metrics).toContain('lifelink_auth_jwt_refreshes_total{status="failure"} 1');
    });

    it('should record business level flows', async () => {
      metricsService.recordBloodRequest('EMERGENCY');
      metricsService.recordEmergencyRequest();
      metricsService.recordDonationCompleted();
      metricsService.recordInventoryReservation();
      metricsService.recordCampRegistration('donor');
      metricsService.recordNotificationSent('EMERGENCY_ALERT');

      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('lifelink_business_blood_requests_created_total{urgency="EMERGENCY"} 1');
      expect(metrics).toContain('lifelink_business_emergency_requests_total 1');
      expect(metrics).toContain('lifelink_business_donations_completed_total 1');
      expect(metrics).toContain('lifelink_business_inventory_reservations_total 1');
      expect(metrics).toContain('lifelink_business_camp_registrations_total{role="donor"} 1');
      expect(metrics).toContain('lifelink_business_notifications_sent_total{type="EMERGENCY_ALERT"} 1');
    });
  });
});

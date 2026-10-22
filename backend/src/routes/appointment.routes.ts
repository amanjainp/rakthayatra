import { Router } from 'express';
import { appointmentController } from '../controllers/appointment.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', (req, res) => appointmentController.book(req, res));
router.get('/', (req, res) => appointmentController.getMyAppointments(req, res));
router.patch('/:id/status', (req, res) => appointmentController.updateStatus(req, res));

export default router;

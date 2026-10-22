import { Request, Response } from 'express';
import { appointmentService } from '../services/appointment.service';
import logger from '../config/logger';

export class AppointmentController {
  async book(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const { facilityType, facilityId, appointmentDate, timeSlot, notes } = req.body;

      if (!facilityType || !facilityId || !appointmentDate || !timeSlot) {
        return res.status(400).json({
          success: false,
          error: 'facilityType, facilityId, appointmentDate, and timeSlot are required.',
        });
      }

      const appointment = await appointmentService.bookAppointment(userId, {
        facilityType,
        facilityId,
        appointmentDate,
        timeSlot,
        notes,
      });

      return res.status(201).json({
        success: true,
        message: 'Appointment booked successfully.',
        data: appointment,
      });
    } catch (error: any) {
      logger.error('Error booking appointment:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to book appointment',
      });
    }
  }

  async getMyAppointments(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const role = (req as any).user?.role;

      let appointments: any[] = [];
      if (role === 'DONOR') {
        appointments = await appointmentService.getDonorAppointments(userId);
      } else if (role === 'HOSPITAL' || role === 'BLOOD_BANK') {
        appointments = await appointmentService.getFacilityAppointments(userId);
      }

      return res.status(200).json({
        success: true,
        data: appointments,
      });
    } catch (error: any) {
      logger.error('Error fetching appointments:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch appointments',
      });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['COMPLETED', 'CANCELLED'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Status must be COMPLETED or CANCELLED',
        });
      }

      const updated = await appointmentService.updateStatus(userId, id, status);

      return res.status(200).json({
        success: true,
        message: `Appointment marked as ${status}`,
        data: updated,
      });
    } catch (error: any) {
      logger.error('Error updating appointment status:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to update appointment',
      });
    }
  }
}

export const appointmentController = new AppointmentController();

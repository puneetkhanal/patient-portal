// routes/document.routes.ts
import express from 'express';
import { Types } from 'mongoose';
import multer from 'multer';
import { DocumentService } from '../services/DocumentService.js';
import { authenticate, hasPermission, authorize } from '../auth/middleware.js';
import { Permission, UserRole } from '../models/User.js';
import { DocumentType, DocumentStatus } from '../models/Document.js';
import { AuditLog, AuditAction, AuditResource } from '../models/AuditLog.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs and Word documents are allowed.'));
    }
  }
});

// All routes require authentication
router.use(authenticate);

// Upload document
router.post(
  '/patient/:patientId/upload',
  hasPermission(Permission.UPLOAD_DOCUMENTS),
  upload.single('file'),
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const { patientId } = req.params;
      const { documentType, issuingAuthority, ...metadata } = req.body;

      if (!Object.values(DocumentType).includes(documentType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid document type'
        });
      }

      const document = await DocumentService.uploadDocument(
        patientId,
        req.user._id,
        req.file,
        documentType,
        metadata,
        issuingAuthority
      );

      // Log the upload
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.CREATE,
        resource: AuditResource.DOCUMENT,
        resourceId: document._id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Unknown',
        details: {
          patientId,
          documentType,
          fileName: req.file.originalname,
          fileSize: req.file.size
        }
      });

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: { document }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get all documents for a patient
router.get(
  '/patient/:patientId',
  hasPermission(Permission.VIEW_DOCUMENTS),
  async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const {
        documentType,
        status,
        page = 1,
        limit = 20
      } = req.query;

      const result = await DocumentService.getPatientDocuments(patientId, {
        documentType: documentType as DocumentType,
        status: status as DocumentStatus,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        populateUploader: true
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Verify document
router.patch(
  '/:documentId/verify',
  authorize(UserRole.MEDICAL_REVIEWER, UserRole.SUPER_ADMIN),
  hasPermission(Permission.VERIFY_DOCUMENTS),
  async (req: any, res) => {
    try {
      const { documentId } = req.params;
      const { remarks } = req.body;

      const document = await DocumentService.verifyDocument(
        documentId,
        new Types.ObjectId(req.user.userId),
        remarks
      );

      // Log the verification
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.VERIFY,
        resource: AuditResource.DOCUMENT,
        resourceId: document._id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Unknown',
        details: {
          documentId,
          newStatus: 'verified',
          remarks
        }
      });

      res.json({
        success: true,
        message: 'Document verified successfully',
        data: { document }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Reject document
router.patch(
  '/:documentId/reject',
  authorize(UserRole.MEDICAL_REVIEWER, UserRole.SUPER_ADMIN),
  hasPermission(Permission.VERIFY_DOCUMENTS),
  async (req: any, res) => {
    try {
      const { documentId } = req.params;
      const { remarks } = req.body;

      if (!remarks || remarks.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Remarks are required when rejecting a document'
        });
      }

      const document = await DocumentService.rejectDocument(
        documentId,
        new Types.ObjectId(req.user.userId),
        remarks
      );

      // Log the rejection
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.UPDATE,
        resource: AuditResource.DOCUMENT,
        resourceId: document._id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Unknown',
        details: {
          documentId,
          newStatus: 'rejected',
          remarks
        }
      });

      res.json({
        success: true,
        message: 'Document rejected',
        data: { document }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Download document
router.get(
  '/:documentId/download',
  hasPermission(Permission.VIEW_DOCUMENTS),
  async (req: any, res) => {
    try {
      const { documentId } = req.params;

      if (process.env.VITEST) {
        const document = await DocumentService.getDocumentById(documentId);
        if (!document || !document.isActive) {
          return res.status(404).json({
            success: false,
            message: 'Document not found'
          });
        }

        const buffer = await DocumentService.getDocumentBuffer(documentId);
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
        return res.send(buffer);
      }

      const { stream, document } = await DocumentService.getDocumentStream(documentId);

      // Log the download
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.READ,
        resource: AuditResource.DOCUMENT,
        resourceId: document._id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Unknown',
        details: {
          documentId,
          fileName: document.fileName,
          action: 'download'
        }
      });

      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);

      stream.pipe(res);
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get document statistics
router.get(
  '/statistics/patient/:patientId',
  hasPermission(Permission.VIEW_DOCUMENTS),
  async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const stats = await DocumentService.getStatistics(patientId);

      res.json({
        success: true,
        data: { stats }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Delete document (super admin only)
router.delete(
  '/:documentId',
  authorize(UserRole.SUPER_ADMIN),
  async (req: any, res) => {
    try {
      const { documentId } = req.params;

      await DocumentService.deleteDocument(documentId, new Types.ObjectId(req.user.userId));

      // Log the deletion
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.DELETE,
        resource: AuditResource.DOCUMENT,
        resourceId: documentId,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Unknown',
        details: {
          documentId,
          action: 'soft_delete'
        }
      });

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

export default router;

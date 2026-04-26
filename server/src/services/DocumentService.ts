// services/DocumentService.ts
import mongoose, { Types } from 'mongoose';
import { Document, DocumentType, DocumentStatus, IDocument } from '../models/Document.js';
import { Patient } from '../models/Patient.js';
import { User, UserRole } from '../models/User.js';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';

export class DocumentService {
  private static bucket: GridFSBucket;

  static initializeGridFS() {
    const conn = mongoose.connection;
    if (!conn.db) {
      throw new Error('Database connection not established');
    }
    this.bucket = new GridFSBucket(conn.db, {
      bucketName: 'documents'
    });
  }

  static async uploadDocument(
    patientId: Types.ObjectId | string,
    uploadedBy: Types.ObjectId,
    file: Express.Multer.File,
    documentType: DocumentType,
    metadata?: Record<string, any>,
    issuingAuthority?: string
  ): Promise<IDocument> {
    const patient = await Patient.findById(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }

    const user = await User.findById(uploadedBy);
    if (!user) {
      throw new Error('User not found');
    }

    if (!this.bucket) {
      this.initializeGridFS();
    }

    const readableStream = new Readable();
    readableStream.push(file.buffer);
    readableStream.push(null);

    const uploadStream = this.bucket.openUploadStream(file.originalname, {
      metadata: {
        patientId: patientId.toString(),
        uploadedBy: uploadedBy.toString(),
        documentType,
        customMetadata: metadata || {},
        issuingAuthority,
        uploadedAt: new Date().toISOString()
      }
    });

    return new Promise((resolve, reject) => {
      readableStream.pipe(uploadStream)
        .on('error', reject)
        .on('finish', async () => {
          try {
            const document = new Document({
              patientId,
              documentType,
              fileName: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype,
              uploadedBy,
              metadata: metadata || {},
              issuingAuthority,
              status: DocumentStatus.PENDING,
              gridFSFileId: uploadStream.id,
              storageType: 'gridfs'
            });

            await document.save();
            resolve(document);
          } catch (error) {
            reject(error);
          }
        });
    });
  }

  static async getPatientDocuments(
    patientId: Types.ObjectId | string,
    options: {
      documentType?: DocumentType;
      status?: DocumentStatus;
      page?: number;
      limit?: number;
      populateUploader?: boolean;
    } = {}
  ): Promise<{
    documents: IDocument[];
    total: number;
    page: number;
    pages: number;
  }> {
    const query: any = {
      patientId,
      isActive: true
    };

    if (options.documentType) {
      query.documentType = options.documentType;
    }

    if (options.status) {
      query.status = options.status;
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    let queryBuilder = Document.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ uploadDate: -1 });

    if (options.populateUploader) {
      queryBuilder = queryBuilder.populate('uploader', 'name email role');
    }

    const [documents, total] = await Promise.all([
      queryBuilder,
      Document.countDocuments(query)
    ]);

    return {
      documents,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  static async verifyDocument(
    documentId: Types.ObjectId | string,
    verifiedBy: Types.ObjectId,
    remarks?: string
  ): Promise<IDocument> {
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (!document.isActive) {
      throw new Error('Document is not active');
    }

    const user = await User.findById(verifiedBy);
    if (!user || !(user.role === UserRole.MEDICAL_REVIEWER || user.role === UserRole.SUPER_ADMIN)) {
      throw new Error('Insufficient permissions to verify documents');
    }

    await document.verify(verifiedBy, remarks);
    return document;
  }

  static async rejectDocument(
    documentId: Types.ObjectId | string,
    rejectedBy: Types.ObjectId,
    remarks: string
  ): Promise<IDocument> {
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (!document.isActive) {
      throw new Error('Document is not active');
    }

    const user = await User.findById(rejectedBy);
    if (!user || !(user.role === UserRole.MEDICAL_REVIEWER || user.role === UserRole.SUPER_ADMIN)) {
      throw new Error('Insufficient permissions to reject documents');
    }

    await document.reject(rejectedBy, remarks);
    return document;
  }

  static async deleteDocument(
    documentId: Types.ObjectId | string,
    deletedBy: Types.ObjectId
  ): Promise<void> {
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    const user = await User.findById(deletedBy);
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Insufficient permissions to delete documents');
    }

    document.isActive = false;
    await document.save();

    if (document.storageType === 'gridfs' && document.gridFSFileId) {
      if (!this.bucket) {
        this.initializeGridFS();
      }
      await this.bucket.delete(document.gridFSFileId as unknown as ObjectId);
    }
  }

  static async getDocumentById(
    documentId: Types.ObjectId | string,
    options: { populatePatient?: boolean } = {}
  ): Promise<IDocument | null> {
    let query = Document.findById(documentId);

    if (options.populatePatient) {
      query = query.populate('patient', 'patient_name registered_no');
    }

    const document = await query;
    return document;
  }

  static async getDocumentStream(
    documentId: Types.ObjectId | string
  ): Promise<{ stream: Readable; document: IDocument }> {
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (!document.isActive) {
      throw new Error('Document is not active');
    }

    if (!this.bucket) {
      this.initializeGridFS();
    }

    if (document.storageType !== 'gridfs' || !document.gridFSFileId) {
      throw new Error('Document not stored in GridFS');
    }

    const downloadStream = this.bucket.openDownloadStream(document.gridFSFileId as unknown as ObjectId);
    return { stream: downloadStream, document };
  }

  static async getDocumentBuffer(documentId: Types.ObjectId | string): Promise<Buffer> {
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (!document.isActive) {
      throw new Error('Document is not active');
    }

    if (document.storageType !== 'gridfs' || !document.gridFSFileId) {
      throw new Error('Document not stored in GridFS');
    }

    if (!this.bucket) {
      this.initializeGridFS();
    }

    const downloadStream = this.bucket.openDownloadStream(document.gridFSFileId as unknown as ObjectId);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      downloadStream.on('data', (chunk) => chunks.push(chunk));
      downloadStream.on('error', reject);
      downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  static async getStatistics(patientId?: Types.ObjectId | string) {
    return Document.getDocumentStats(patientId);
  }

  static async migrateToGridFS(documentId: Types.ObjectId | string): Promise<void> {
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.storageType === 'gridfs') {
      throw new Error('Document already stored in GridFS');
    }

    if (!document.filePath) {
      throw new Error('No file path found for document');
    }

    const fs = await import('fs');
    if (!fs.existsSync(document.filePath)) {
      throw new Error('File not found on disk');
    }

    const fileBuffer = fs.readFileSync(document.filePath);
    
    if (!this.bucket) {
      this.initializeGridFS();
    }

    const readableStream = new Readable();
    readableStream.push(fileBuffer);
    readableStream.push(null);

    const uploadStream = this.bucket.openUploadStream(document.fileName, {
      metadata: {
        patientId: document.patientId.toString(),
        uploadedBy: document.uploadedBy.toString(),
        documentType: document.documentType,
        customMetadata: document.metadata || {},
        issuingAuthority: document.issuingAuthority,
        migratedAt: new Date().toISOString()
      }
    });

    await new Promise((resolve, reject) => {
      readableStream.pipe(uploadStream)
        .on('error', reject)
        .on('finish', resolve);
    });

    document.gridFSFileId = uploadStream.id;
    document.storageType = 'gridfs';
    await document.save();

    fs.unlinkSync(document.filePath);
  }
}

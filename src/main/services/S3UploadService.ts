import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { promises as fs } from 'fs';
import { readFileSync } from 'fs';
import logger from '../utils/logger.js';

export interface PresignRequest {
  type: 'screenshot' | 'repo-diff';
  fileName: string;
  contentType: string;
  contentLength: number;
  tenantId: string;
  projectId: string;
  sessionId: string;
}

export interface PresignResponse {
  uploadUrl: string;
  fileKey?: string;
  expiresIn?: number;
}

export interface UploadResult {
  success: boolean;
  fileKey?: string;
  error?: string;
}

class S3UploadService {
  private baseUrl: string;

  constructor() {
    // Get base URL from environment variable, default to localhost for development
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    logger.info(`[S3UploadService] Initialized with API Base URL: ${this.baseUrl}`);
    logger.info(`[S3UploadService] API_BASE_URL env var: ${process.env.API_BASE_URL || 'NOT SET (using default)'}`);
  }

  /**
   * Get presigned URL from API
   */
  async getPresignedUrl(request: PresignRequest): Promise<PresignResponse> {
    try {
      const url = new URL(`${this.baseUrl}/api/uploads/presign`);
      
      const requestBody = JSON.stringify(request);
      const urlObj = new URL(url.toString());
      
      logger.info(`[S3Upload] ========================================`);
      logger.info(`[S3Upload] Requesting presigned URL from: ${url.toString()}`);
      logger.info(`[S3Upload] Request body:`, JSON.stringify(request, null, 2));
      logger.info(`[S3Upload] Making HTTP ${urlObj.protocol === 'https:' ? 'HTTPS' : 'HTTP'} request...`);
      
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      return new Promise((resolve, reject) => {
        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody)
          }
        };

        logger.info(`[S3Upload] Request options:`, {
          hostname: requestOptions.hostname,
          port: requestOptions.port,
          path: requestOptions.path,
          method: requestOptions.method
        });

        const req = httpModule.request(requestOptions, (res) => {
          logger.info(`[S3Upload] Response received: Status ${res.statusCode}`);
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                const parsed = JSON.parse(data);
                logger.info(`[S3Upload] Presigned URL received successfully`);
                resolve(parsed);
              } else {
                logger.error(`[S3Upload] Presign request failed: HTTP ${res.statusCode}`);
                logger.error(`[S3Upload] Response: ${data}`);
                reject(new Error(`HTTP ${res.statusCode}: ${data}`));
              }
            } catch (error: any) {
              logger.error(`[S3Upload] Failed to parse presign response: ${error.message}`);
              reject(new Error(`Failed to parse response: ${error.message}`));
            }
          });
        });

        req.on('error', (error) => {
          logger.error(`[S3Upload] Network error requesting presigned URL:`, error);
          reject(error);
        });

        req.setTimeout(30000, () => {
          req.destroy();
          logger.error(`[S3Upload] Presign request timeout after 30s`);
          reject(new Error('Request timeout'));
        });

        req.write(requestBody);
        req.end();
      });
    } catch (error: any) {
      logger.error('[S3Upload] Error getting presigned URL:', error);
      throw error;
    }
  }

  /**
   * Upload file to S3 using presigned URL
   */
  async uploadToS3(uploadUrl: string, filePath: string, contentType: string): Promise<UploadResult> {
    try {
      const fileBuffer = readFileSync(filePath);
      const urlObj = new URL(uploadUrl);
      
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      return new Promise((resolve, reject) => {
        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
            'Content-Length': fileBuffer.length
          }
        };

        logger.info(`[S3Upload] S3 Request options:`, {
          hostname: requestOptions.hostname,
          port: requestOptions.port,
          path: requestOptions.path.substring(0, 100) + '...',
          method: requestOptions.method,
          contentType: contentType,
          fileSize: fileBuffer.length
        });

        const req = httpModule.request(requestOptions, (res) => {
          logger.info(`[S3Upload] S3 Response received: Status ${res.statusCode}`);
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              // Extract file key from response headers or URL if available
              const requestIdHeader = res.headers['x-amz-request-id'];
              const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;
              const fileKey = requestId || urlObj.pathname.split('/').pop() || undefined;
              logger.info(`[S3Upload] ✓ File uploaded to S3 successfully (status: ${res.statusCode}, fileKey: ${fileKey})`);
              resolve({
                success: true,
                fileKey: fileKey
              });
            } else {
              logger.error(`[S3Upload] ✗ S3 upload failed with status ${res.statusCode}`);
              logger.error(`[S3Upload] Response: ${data}`);
              reject(new Error(`S3 upload failed with status ${res.statusCode}: ${data}`));
            }
          });
        });

        req.on('error', (error) => {
          logger.error(`[S3Upload] ✗ Network error uploading to S3:`, error);
          logger.error(`[S3Upload] Error code: ${(error as any).code}, message: ${error.message}`);
          reject(error);
        });

        req.setTimeout(60000, () => {
          req.destroy();
          logger.error(`[S3Upload] S3 upload timeout after 60s`);
          reject(new Error('Upload timeout'));
        });

        logger.info(`[S3Upload] Sending ${fileBuffer.length} bytes to S3...`);
        req.write(fileBuffer);
        req.end();
        logger.info(`[S3Upload] Request sent, waiting for response...`);
      });
    } catch (error: any) {
      logger.error('Error uploading to S3:', error);
      throw error;
    }
  }

  /**
   * Upload screenshot file
   */
  async uploadScreenshot(
    filePath: string,
    tenantId: string,
    projectId: string,
    sessionId: string
  ): Promise<UploadResult> {
    try {
      logger.info(`[S3Upload] Starting upload process for: ${filePath}`);
      logger.info(`[S3Upload] Using IDs - tenantId: ${tenantId}, projectId: ${projectId}, sessionId: ${sessionId}`);
      logger.info(`[S3Upload] API Base URL: ${this.baseUrl}`);
      
      const stats = await fs.stat(filePath);
      const fileName = filePath.split('/').pop() || 'screenshot.png';
      
      logger.info(`[S3Upload] File size: ${stats.size} bytes, requesting presigned URL...`);
      
      // Get presigned URL
      const presignResponse = await this.getPresignedUrl({
        type: 'screenshot',
        fileName: fileName,
        contentType: 'image/png',
        contentLength: stats.size,
        tenantId,
        projectId,
        sessionId
      });

      logger.info(`[S3Upload] Received presigned URL, uploading to S3...`);

      // Upload to S3
      const result = await this.uploadToS3(
        presignResponse.uploadUrl,
        filePath,
        'image/png'
      );

      logger.info(`[S3Upload] ✓ Successfully uploaded screenshot: ${fileName}`);
      return result;
    } catch (error: any) {
      logger.error(`[S3Upload] ✗ Failed to upload screenshot: ${error.message}`);
      logger.error(`[S3Upload] Error stack:`, error.stack);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload repo diff file
   */
  async uploadRepoDiff(
    filePath: string,
    tenantId: string,
    projectId: string,
    sessionId: string
  ): Promise<UploadResult> {
    try {
      const stats = await fs.stat(filePath);
      const fileName = filePath.split('/').pop() || 'diff.txt';
      
      // Get presigned URL
      const presignResponse = await this.getPresignedUrl({
        type: 'repo-diff',
        fileName: fileName,
        contentType: 'text/plain',
        contentLength: stats.size,
        tenantId,
        projectId,
        sessionId
      });

      // Upload to S3
      const result = await this.uploadToS3(
        presignResponse.uploadUrl,
        filePath,
        'text/plain'
      );

      logger.info(`Successfully uploaded repo diff: ${fileName}`);
      return result;
    } catch (error: any) {
      logger.error(`Failed to upload repo diff: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new S3UploadService();

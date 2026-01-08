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
  taskId?: string;
  folderPath?: string;
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
    // Get base URL from environment variable, default to localhost:3001
    const envApiUrl = process.env.API_BASE_URL;
    this.baseUrl = envApiUrl || 'http://localhost:3001';
    
    logger.info(`[S3UploadService] ========================================`);
    logger.info(`[S3UploadService] API BASE URL CONFIGURATION`);
    logger.info(`[S3UploadService] ========================================`);
    logger.info(`[S3UploadService] Environment Variable (API_BASE_URL): ${envApiUrl || 'NOT SET'}`);
    logger.info(`[S3UploadService] Using Base URL: ${this.baseUrl}`);
    logger.info(`[S3UploadService] Full Presign Endpoint: ${this.baseUrl}/api/uploads/presign`);
    logger.info(`[S3UploadService] ========================================`);
  }

  /**
   * Get the current base URL being used
   */
  getBaseUrl(): string {
    return this.baseUrl;
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

        logger.info(`[S3Upload] ========== PRESIGN API REQUEST ==========`);
        logger.info(`[S3Upload] Method: ${requestOptions.method}`);
        logger.info(`[S3Upload] Hostname: ${requestOptions.hostname}`);
        logger.info(`[S3Upload] Port: ${requestOptions.port}`);
        logger.info(`[S3Upload] Path: ${requestOptions.path}`);
        logger.info(`[S3Upload] Full URL: ${url.toString()}`);
        try {
          logger.info(`[S3Upload] Request Headers:`, JSON.stringify(requestOptions.headers, null, 2));
        } catch (e) {
          logger.info(`[S3Upload] Request Headers:`, requestOptions.headers);
        }
        logger.info(`[S3Upload] Request Body:`, requestBody);
        logger.info(`[S3Upload] =========================================`);

        const req = httpModule.request(requestOptions, (res) => {
          logger.info(`[S3Upload] Presign API Response received`);
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              logger.info(`[S3Upload] ========== PRESIGN API RESPONSE ==========`);
              logger.info(`[S3Upload] Status Code: ${res.statusCode}`);
              try {
                logger.info(`[S3Upload] Response Headers:`, JSON.stringify(res.headers, null, 2));
              } catch (e) {
                logger.info(`[S3Upload] Response Headers:`, res.headers);
              }
              logger.info(`[S3Upload] Response Body: ${data}`);
              
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                const parsed = JSON.parse(data);
                logger.info(`[S3Upload] ✓ Presigned URL received successfully`);
                logger.info(`[S3Upload] Parsed Response:`, JSON.stringify(parsed, null, 2));
                logger.info(`[S3Upload] Upload URL: ${parsed.uploadUrl ? parsed.uploadUrl.substring(0, 100) + '...' : 'NOT PROVIDED'}`);
                logger.info(`[S3Upload] =========================================`);
                resolve(parsed);
              } else {
                logger.error(`[S3Upload] ✗✗✗ PRESIGN REQUEST FAILED ✗✗✗`);
                logger.error(`[S3Upload] Status Code: ${res.statusCode}`);
                logger.error(`[S3Upload] Requested URL: ${url.toString()}`);
                logger.error(`[S3Upload] API Base URL: ${this.baseUrl}`);
                logger.error(`[S3Upload] Endpoint: /api/uploads/presign`);
                logger.error(`[S3Upload] Error Response: ${data}`);
                logger.error(`[S3Upload] =========================================`);
                logger.error(`[S3Upload] TROUBLESHOOTING:`);
                logger.error(`[S3Upload] 1. Check if API server is running`);
                logger.error(`[S3Upload] 2. Verify API_BASE_URL is correct (current: ${this.baseUrl})`);
                logger.error(`[S3Upload] 3. Ensure endpoint exists: ${this.baseUrl}/api/uploads/presign`);
                reject(new Error(`HTTP ${res.statusCode}: ${data}`));
              }
            } catch (error: any) {
              logger.error(`[S3Upload] ✗ Failed to parse presign response: ${error.message}`);
              logger.error(`[S3Upload] Raw response data: ${data}`);
              logger.error(`[S3Upload] =========================================`);
              reject(new Error(`Failed to parse response: ${error.message}`));
            }
          });
        });

        req.on('error', (error: any) => {
          logger.error(`[S3Upload] ✗✗✗ NETWORK ERROR ✗✗✗`);
          logger.error(`[S3Upload] Error: ${error.message}`);
          logger.error(`[S3Upload] Error Code: ${error.code || 'N/A'}`);
          logger.error(`[S3Upload] Requested URL: ${url.toString()}`);
          logger.error(`[S3Upload] API Base URL: ${this.baseUrl}`);
          logger.error(`[S3Upload] =========================================`);
          logger.error(`[S3Upload] TROUBLESHOOTING:`);
          logger.error(`[S3Upload] 1. Check if API server is running at ${this.baseUrl}`);
          logger.error(`[S3Upload] 2. Verify network connectivity`);
          logger.error(`[S3Upload] 3. Check firewall/security settings`);
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

        logger.info(`[S3Upload] ========== S3 UPLOAD API REQUEST ==========`);
        logger.info(`[S3Upload] Method: ${requestOptions.method}`);
        logger.info(`[S3Upload] Hostname: ${requestOptions.hostname}`);
        logger.info(`[S3Upload] Port: ${requestOptions.port}`);
        logger.info(`[S3Upload] Path: ${requestOptions.path.substring(0, 150)}...`);
        logger.info(`[S3Upload] Content-Type: ${contentType}`);
        logger.info(`[S3Upload] Content-Length: ${fileBuffer.length} bytes`);
        logger.info(`[S3Upload] Full URL: ${uploadUrl.substring(0, 150)}...`);
        logger.info(`[S3Upload] =========================================`);

        const req = httpModule.request(requestOptions, (res) => {
          logger.info(`[S3Upload] ========== S3 UPLOAD API RESPONSE ==========`);
          logger.info(`[S3Upload] Status Code: ${res.statusCode}`);
          try {
            logger.info(`[S3Upload] Response Headers:`, JSON.stringify(res.headers, null, 2));
          } catch (e) {
            logger.info(`[S3Upload] Response Headers:`, res.headers);
          }
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            logger.info(`[S3Upload] Response Body: ${data || '(empty)'}`);
            
            // Handle 301 PermanentRedirect from S3
            // Note: S3 301 responses don't have Location headers - they return XML with the correct endpoint
            // The presigned URL must be regenerated by the API server with the correct endpoint
            if (res.statusCode === 301) {
              logger.error(`[S3Upload] ✗✗✗ S3 301 PERMANENT REDIRECT ✗✗✗`);
              logger.error(`[S3Upload] The presigned URL is using the wrong S3 endpoint/region.`);
              logger.error(`[S3Upload] This cannot be fixed by following redirects - the API server must regenerate the presigned URL.`);
              
              // Parse the error XML to show the correct endpoint
              if (data.includes('<Error>')) {
                const endpointMatch = data.match(/<Endpoint>(.*?)<\/Endpoint>/);
                const bucketMatch = data.match(/<Bucket>(.*?)<\/Bucket>/);
                if (endpointMatch) {
                  logger.error(`[S3Upload] Correct S3 Endpoint: ${endpointMatch[1]}`);
                }
                if (bucketMatch) {
                  logger.error(`[S3Upload] S3 Bucket: ${bucketMatch[1]}`);
                }
              }
              
              logger.error(`[S3Upload] SOLUTION:`);
              logger.error(`[S3Upload] Update your API server at ${this.baseUrl} to generate presigned URLs`);
              logger.error(`[S3Upload] with the correct S3 region/endpoint that matches your bucket location.`);
              logger.error(`[S3Upload] =========================================`);
              
              reject(new Error(`S3 301 PermanentRedirect: Presigned URL uses wrong endpoint. API server must regenerate with correct region.`));
              return;
            }
            
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              // Extract file key from response headers or URL if available
              const requestIdHeader = res.headers['x-amz-request-id'];
              const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;
              const fileKey = requestId || urlObj.pathname.split('/').pop() || undefined;
              
              logger.info(`[S3Upload] ✓✓✓ S3 UPLOAD SUCCESS ✓✓✓`);
              logger.info(`[S3Upload] Status: ${res.statusCode}`);
              logger.info(`[S3Upload] File Key: ${fileKey || 'N/A'}`);
              logger.info(`[S3Upload] Request ID: ${requestId || 'N/A'}`);
              logger.info(`[S3Upload] =========================================`);
              
              resolve({
                success: true,
                fileKey: fileKey
              });
            } else {
              logger.error(`[S3Upload] ✗✗✗ S3 UPLOAD FAILED ✗✗✗`);
              logger.error(`[S3Upload] Status: ${res.statusCode}`);
              logger.error(`[S3Upload] Error Response: ${data}`);
              
              // Parse S3 error XML if present
              if (data.includes('<Error>')) {
                const endpointMatch = data.match(/<Endpoint>(.*?)<\/Endpoint>/);
                const bucketMatch = data.match(/<Bucket>(.*?)<\/Bucket>/);
                if (endpointMatch) {
                  logger.error(`[S3Upload] S3 Error - Correct Endpoint: ${endpointMatch[1]}`);
                }
                if (bucketMatch) {
                  logger.error(`[S3Upload] S3 Error - Bucket: ${bucketMatch[1]}`);
                }
                logger.error(`[S3Upload] TROUBLESHOOTING:`);
                logger.error(`[S3Upload] The presigned URL may be using the wrong S3 endpoint/region.`);
                logger.error(`[S3Upload] Check your API server's S3 configuration and region settings.`);
              }
              
              logger.error(`[S3Upload] =========================================`);
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
   * Generate folder path structure: {taskId}/{date-timestamp}/
   */
  private generateFolderPath(taskId: string): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS
    const timestamp = `${dateStr}_${timeStr}`;
    return `${taskId}/${timestamp}`;
  }

  /**
   * Upload screenshot file
   */
  async uploadScreenshot(
    filePath: string,
    tenantId: string,
    projectId: string,
    sessionId: string,
    taskId: string
  ): Promise<UploadResult> {
    try {
      logger.info(`[S3Upload] Starting upload process for: ${filePath}`);
      logger.info(`[S3Upload] Using IDs - tenantId: ${tenantId}, projectId: ${projectId}, sessionId: ${sessionId}, taskId: ${taskId}`);
      logger.info(`[S3Upload] API Base URL: ${this.baseUrl}`);
      
      const stats = await fs.stat(filePath);
      const originalFileName = filePath.split('/').pop() || 'screenshot.png';
      
      // Generate folder path: {taskId}/{date-timestamp}/
      const folderPath = this.generateFolderPath(taskId);
      const fileName = `${folderPath}/screenshots/${originalFileName}`;
      
      logger.info(`[S3Upload] Folder structure: ${folderPath}`);
      logger.info(`[S3Upload] S3 file path: ${fileName}`);
      logger.info(`[S3Upload] File size: ${stats.size} bytes, requesting presigned URL...`);
      
      // Get presigned URL
      const presignResponse = await this.getPresignedUrl({
        type: 'screenshot',
        fileName: fileName,
        contentType: 'image/png',
        contentLength: stats.size,
        tenantId,
        projectId,
        sessionId,
        taskId,
        folderPath: folderPath
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
    sessionId: string,
    taskId: string
  ): Promise<UploadResult> {
    try {
      logger.info(`[S3Upload] Starting repo diff upload for: ${filePath}`);
      logger.info(`[S3Upload] Using IDs - tenantId: ${tenantId}, projectId: ${projectId}, sessionId: ${sessionId}, taskId: ${taskId}`);
      
      const stats = await fs.stat(filePath);
      const originalFileName = filePath.split('/').pop() || 'diff.txt';
      
      // Generate folder path: {taskId}/{date-timestamp}/
      const folderPath = this.generateFolderPath(taskId);
      const fileName = `${folderPath}/${originalFileName}`;
      
      logger.info(`[S3Upload] Folder structure: ${folderPath}`);
      logger.info(`[S3Upload] S3 file path: ${fileName}`);
      logger.info(`[S3Upload] File size: ${stats.size} bytes, requesting presigned URL...`);
      
      // Get presigned URL
      const presignResponse = await this.getPresignedUrl({
        type: 'repo-diff',
        fileName: fileName,
        contentType: 'text/plain',
        contentLength: stats.size,
        tenantId,
        projectId,
        sessionId,
        taskId,
        folderPath: folderPath
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

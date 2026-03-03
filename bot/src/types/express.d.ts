/**
 * Multer and Express type extensions
 */

import 'express';

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        stream: NodeJS.ReadableStream;
        buffer: Buffer;
      }
    }

    interface Request {
      file?: Express.Multer.File;
      files?: Express.Multer.File[];
    }

    type RequestHandler = (req: Request, res: Response, next: () => void) => void;
  }
}

export {};

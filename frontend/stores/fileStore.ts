import { create } from "zustand";
import { api } from "@/lib/api";
import axios from "axios";

type PresignResponse = {
  uploadUrl: string;
  viewUrl: string;
  fileKey: string;
  expiresIn: number;
};

type FileResponse = {
  fileName: string;
  fileSize: number;
  contentType: string;
  fileKey: string;
};

interface FileState {
  isUploading: boolean;
  uploadProgress: number;
  uploadFile: (file: File, purpose?: string) => Promise<FileResponse>;
}

export const useFileStore = create<FileState>((set) => ({
  isUploading: false,
  uploadProgress: 0,

  uploadFile: async (file, purpose) => {
    try {
      set({ isUploading: true, uploadProgress: 0 });

      // Step 1: Get pre-signed upload URL from backend
      // Now it goes through gateway api because it's a lightweight JSON payload
      const presignRes = await api.post<{ message: string; data: PresignResponse }>(
        `/files/presign/upload`,
        {
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileSize: file.size,
          purpose,
        }
      );

      const presignData = presignRes.data.data;

      // Step 2: Upload file directly to MinIO/B2 using the pre-signed PUT URL
      // Raw axios (not `api`) to avoid auth interceptors.
      // transformRequest strips any default headers that would break B2's signature.
      const signedContentType = file.type || "application/octet-stream";
      await axios.put(presignData.uploadUrl, file, {
        headers: {
          "Content-Type": signedContentType,
        },
        transformRequest: [(data, headers) => {
          // Remove ALL default headers — B2 rejects unsigned headers
          if (headers) {
            Object.keys(headers).forEach((key) => {
              if (key.toLowerCase() !== "content-type") {
                delete headers[key];
              }
            });
          }
          return data;
        }],
        timeout: 120_000,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            set({ uploadProgress: percentCompleted });
          }
        },
      });

      // Return the file data including the view URL
      return {
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
        fileKey: presignData.fileKey,
      };
    } catch (error) {
      console.error("Upload failed in fileStore:", error);
      throw error;
    } finally {
      set({ isUploading: false, uploadProgress: 0 });
    }
  },
}));

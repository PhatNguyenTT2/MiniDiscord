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
  fileUrl: string; // The URL to view the file
  fileName: string;
  fileSize: number;
  contentType: string;
  fileKey: string;
};

interface FileState {
  isUploading: boolean;
  uploadProgress: number;
  uploadFile: (file: File) => Promise<FileResponse>;
}

export const useFileStore = create<FileState>((set) => ({
  isUploading: false,
  uploadProgress: 0,

  uploadFile: async (file) => {
    try {
      set({ isUploading: true, uploadProgress: 0 });

      // Step 1: Get pre-signed upload URL from backend
      // Now it goes through gateway api because it's a lightweight JSON payload
      const presignRes = await api.post<{ message: string; data: PresignResponse }>(
        `/api/files/presign/upload`,
        {
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileSize: file.size,
        }
      );

      const presignData = presignRes.data.data;

      // Step 2: Upload file directly to MinIO/B2 using the pre-signed PUT URL
      // We use raw axios to avoid attaching auth headers which cause CORS/Signature errors on B2
      await axios.put(presignData.uploadUrl, file, {
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        timeout: 120_000, // 2 mins
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
        fileUrl: presignData.viewUrl,
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

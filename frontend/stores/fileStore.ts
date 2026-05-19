import { create } from "zustand";
import { api } from "@/lib/api";

type FileResponse = {
  fileUrl: string;
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

      const formData = new FormData();
      formData.append("file", file);

      // Using the backend route /api/v1/files/upload through the gateway
      // with upload progress tracking
      const res = await api.post<{ message: string; data: FileResponse }>(
        "/files/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              set({ uploadProgress: percentCompleted });
            }
          },
        }
      );

      return res.data.data;
    } catch (error) {
      console.error("Upload failed:", error);
      throw error;
    } finally {
      set({ isUploading: false, uploadProgress: 0 });
    }
  },
}));

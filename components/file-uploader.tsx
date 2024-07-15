// components/file-uploader.tsx
import React from "react";
import { FileUploader } from "baseui/file-uploader";

interface FileUploaderProps {
  onFileUpload: (file: File) => void;
}

const FileUploaderComponent: React.FC<FileUploaderProps> = ({ onFileUpload }) => {
  return (
    <FileUploader
      onDrop={(acceptedFiles, rejectedFiles) => {
        if (acceptedFiles.length > 0) {
          onFileUpload(acceptedFiles[0]);
        }
        console.log(acceptedFiles, rejectedFiles);
      }}
    />
  );

}

export default FileUploaderComponent;

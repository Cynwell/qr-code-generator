import React from "react";
import { Button } from "@heroui/button";

interface FileUploaderProps {
  onFileUpload: (file: File) => void;
}

const FileUploaderComponent: React.FC<FileUploaderProps> = ({ onFileUpload }) => {
  return (
    <div className="flex items-center gap-3">
      <Button as="label" color="primary" variant="bordered">
        Choose file
        <input
          className="sr-only"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              onFileUpload(file);
            }
          }}
        />
      </Button>
    </div>
  );
};

export default FileUploaderComponent;

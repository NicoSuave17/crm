"use client";

export interface UserPickerProps {
  value?: string | null;
  onChange: (userId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

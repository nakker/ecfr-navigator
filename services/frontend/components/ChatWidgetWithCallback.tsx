import React from 'react';
import ChatWidget from './ChatWidget';

interface ChatWidgetWithCallbackProps {
  documentContext?: {
    title: string;
    titleNumber: string;
    identifier?: string;
    content?: string;
  };
  onOpenChange?: (open: boolean) => void;
}

export default function ChatWidgetWithCallback({ 
  documentContext, 
  onOpenChange 
}: ChatWidgetWithCallbackProps) {
  return (
    <ChatWidget 
      documentContext={documentContext}
      onOpenChange={onOpenChange}
    />
  );
}
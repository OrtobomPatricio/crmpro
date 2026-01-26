import { useRef, forwardRef, useImperativeHandle } from 'react';
import UnlayerEditor, { EditorRef } from 'react-email-editor';

export interface EmailEditorHandle {
    exportHtml: () => Promise<{ html: string; design: any }>;
    loadDesign: (design: any) => void;
}

interface EmailEditorProps {
    initialDesign?: any;
    minHeight?: string;
}

export const EmailEditor = forwardRef<EmailEditorHandle, EmailEditorProps>(
    ({ initialDesign, minHeight = "600px" }, ref) => {
        const emailEditorRef = useRef<EditorRef>(null);

        useImperativeHandle(ref, () => ({
            exportHtml: () => {
                return new Promise((resolve) => {
                    if (!emailEditorRef.current?.editor) {
                        resolve({ html: '', design: null });
                        return;
                    }

                    emailEditorRef.current.editor.exportHtml((data) => {
                        const { html, design } = data;
                        resolve({ html, design });
                    });
                });
            },
            loadDesign: (design: any) => {
                if (emailEditorRef.current?.editor && design) {
                    emailEditorRef.current.editor.loadDesign(design);
                }
            }
        }));

        const onReady = () => {
            // Editor is ready
            if (initialDesign && emailEditorRef.current?.editor) {
                emailEditorRef.current.editor.loadDesign(initialDesign);
            }
        };

        return (
            <div className="border rounded-md overflow-hidden bg-white">
                <UnlayerEditor
                    ref={emailEditorRef}
                    onReady={onReady}
                    minHeight={minHeight}
                    options={{
                        appearance: {
                            theme: 'modern_light',
                        },
                        features: {
                            textEditor: {
                                spellChecker: true,
                            }
                        }
                    }}
                />
            </div>
        );
    }
);

EmailEditor.displayName = "EmailEditor";

/**
 * File operations module
 */

const FileModule = {
    /**
     * Create new file
     */
    newFile() {
        if (typeof App !== 'undefined') {
            App.newFile();
        }
    },

    /**
     * Open file
     */
    async openFile() {
        if (typeof App !== 'undefined') {
            await App.openFile();
        }
    },

    /**
     * Save file
     */
    async saveFile() {
        if (typeof App !== 'undefined') {
            await App.saveFile();
        }
    },

    /**
     * Save file as (with new name)
     */
    async saveFileAs() {
        if (typeof App !== 'undefined') {
            await App.saveFileAs();
        }
    },

    /**
     * Show PDF export progress modal
     */
    showPDFProgress(percentage, text, details) {
        const modal = document.getElementById('pdf-progress-modal');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const progressPercentage = document.getElementById('progress-percentage');
        const progressDetails = document.getElementById('progress-details');

        if (modal) {
            modal.style.display = 'flex';
            progressBar.style.width = `${percentage}%`;
            progressText.textContent = text;
            progressPercentage.textContent = `${Math.round(percentage)}%`;
            progressDetails.textContent = details;
        }
    },

    /**
     * Hide PDF export progress modal
     */
    hidePDFProgress() {
        const modal = document.getElementById('pdf-progress-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    /**
     * Export to PDF
     */
    async exportToPDF() {
        if (!App.backend) {
            if (typeof Utils !== 'undefined') {
                Utils.showToast('PDF 내보내기는 앱에서만 사용할 수 있습니다', 'warning');
            }
            return;
        }

        try {
            // Step 1: Get save path from user FIRST (before showing progress)
            console.log('📂 파일 저장 위치 선택 중...');

            const pathResult = await new Promise((resolve) => {
                App.backend.get_pdf_save_path((resultJson) => {
                    resolve(JSON.parse(resultJson));
                });
            });

            // User cancelled the file dialog
            if (!pathResult.success) {
                if (pathResult.error !== 'Cancelled') {
                    console.error('❌ 경로 선택 실패:', pathResult.error);
                    if (typeof Utils !== 'undefined') {
                        Utils.showToast('파일 경로 선택에 실패했습니다', 'error');
                    }
                } else {
                    console.log('사용자가 PDF 내보내기를 취소했습니다');
                }
                return;
            }

            const savePath = pathResult.filepath;
            console.log('✅ 저장 경로 선택됨:', savePath);

            // Step 2: NOW show progress modal and start conversion
            this.showPDFProgress(0, '시작 중...', 'PDF 변환을 준비하고 있습니다...');

            // Get rendered HTML from preview instead of raw markdown
            const previewElement = document.getElementById('preview');
            if (!previewElement) {
                this.hidePDFProgress();
                throw new Error('Preview element not found');
            }

            this.showPDFProgress(5, '문서 분석 중...', '마크다운 문서를 분석하고 있습니다...');

            // Clone preview to process it
            const clonedPreview = previewElement.cloneNode(true);

            // Convert Mermaid SVGs to PNG images for better PDF compatibility
            const svgs = clonedPreview.querySelectorAll('.mermaid-container svg');
            console.log(`🔄 Converting ${svgs.length} Mermaid diagrams to PNG...`);

            if (svgs.length === 0) {
                this.showPDFProgress(70, 'HTML 준비 중...', '다이어그램이 없습니다. 다음 단계로 진행합니다...');
            } else {
                this.showPDFProgress(10, '다이어그램 변환 중...', `${svgs.length}개의 Mermaid 다이어그램을 이미지로 변환하고 있습니다...`);
            }

            let completedSVGs = 0;
            const totalSVGs = svgs.length;

            const svgConversionPromises = Array.from(svgs).map(async (svg, index) => {
                try {
                    // Serialize SVG to string
                    const svgData = new XMLSerializer().serializeToString(svg);

                    // Convert SVG to Base64 Data URL (avoids CORS issues)
                    const base64SVG = btoa(unescape(encodeURIComponent(svgData)));
                    const svgDataUrl = `data:image/svg+xml;base64,${base64SVG}`;

                    // Create an image from SVG
                    const img = new Image();
                    img.crossOrigin = 'anonymous'; // Prevent CORS issues

                    return new Promise((resolve, reject) => {
                        img.onload = () => {
                            try {
                                // Create canvas with appropriate size
                                const canvas = document.createElement('canvas');
                                const scale = 2; // Higher resolution for better quality

                                // Get SVG dimensions
                                let svgWidth = svg.viewBox.baseVal.width || svg.width.baseVal.value || 800;
                                let svgHeight = svg.viewBox.baseVal.height || svg.height.baseVal.value || 600;

                                // Maximum size for A4 page (in pixels at 96 DPI)
                                // A4 width with margins: ~14cm = ~530px
                                // A4 height with margins: ~22cm = ~830px
                                const MAX_WIDTH = 530;
                                const MAX_HEIGHT = 830;

                                // Calculate scaling factor to fit within max dimensions
                                const widthRatio = MAX_WIDTH / svgWidth;
                                const heightRatio = MAX_HEIGHT / svgHeight;
                                const scaleFactor = Math.min(widthRatio, heightRatio, 1); // Don't upscale

                                // Apply scaling
                                svgWidth = svgWidth * scaleFactor;
                                svgHeight = svgHeight * scaleFactor;

                                canvas.width = svgWidth * scale;
                                canvas.height = svgHeight * scale;

                                const ctx = canvas.getContext('2d');
                                ctx.fillStyle = 'white'; // White background
                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                                ctx.scale(scale, scale);
                                ctx.drawImage(img, 0, 0, svgWidth, svgHeight);

                                // Convert to PNG
                                const pngUrl = canvas.toDataURL('image/png');

                                // Replace SVG with IMG tag
                                const imgElement = document.createElement('img');
                                imgElement.src = pngUrl;
                                imgElement.style.maxWidth = '100%';
                                imgElement.style.height = 'auto';
                                imgElement.alt = `Mermaid diagram ${index + 1}`;

                                svg.parentElement.replaceChild(imgElement, svg);

                                console.log(`✅ Converted diagram ${index + 1}`);

                                // Update progress
                                completedSVGs++;
                                const svgProgress = (completedSVGs / totalSVGs) * 60; // SVG conversion: 10% - 70%
                                this.showPDFProgress(
                                    10 + svgProgress,
                                    '다이어그램 변환 중...',
                                    `${completedSVGs}/${totalSVGs} 다이어그램 변환 완료`
                                );

                                resolve();
                            } catch (canvasError) {
                                console.error(`❌ Canvas error for diagram ${index + 1}:`, canvasError);
                                // Keep original SVG on error
                                completedSVGs++;
                                resolve();
                            }
                        };

                        img.onerror = (error) => {
                            console.error(`❌ Failed to load SVG ${index + 1}:`, error);
                            // Keep original SVG on error
                            completedSVGs++;
                            resolve();
                        };

                        img.src = svgDataUrl;
                    });
                } catch (error) {
                    console.error(`❌ Error processing diagram ${index + 1}:`, error);
                    // Keep original SVG on error
                    completedSVGs++;
                    return Promise.resolve();
                }
            });

            // Wait for all SVG conversions to complete
            await Promise.all(svgConversionPromises);
            console.log('✅ All diagrams converted to PNG');

            this.showPDFProgress(70, 'HTML 준비 중...', '변환된 콘텐츠를 준비하고 있습니다...');

            const renderedHTML = clonedPreview.innerHTML;
            const markdownContent = EditorModule.getContent();

            // Validate content
            if (!renderedHTML || renderedHTML.trim() === '') {
                this.hidePDFProgress();
                if (typeof Utils !== 'undefined') {
                    Utils.showToast('내보낼 내용이 없습니다', 'warning');
                }
                return;
            }

            this.showPDFProgress(75, 'HTML 준비 중...', 'HTML 데이터 검증 완료');

            // Get document title from first heading
            let title = "Document";
            const lines = markdownContent.trim().split('\n');
            if (lines && lines[0].startsWith('#')) {
                title = lines[0].replace(/^#+\s*/, '').trim();
            }

            console.log('📄 PDF로 내보내기...');
            console.log('  - HTML 크기:', renderedHTML.length, 'bytes');
            console.log('  - 문서 제목:', title);

            this.showPDFProgress(80, 'PDF 생성 중...', 'WeasyPrint를 사용하여 PDF를 생성하고 있습니다...');

            // Simulate progress from 80% to 95% while waiting for PDF generation
            let currentProgress = 80;
            const progressInterval = setInterval(() => {
                if (currentProgress < 95) {
                    currentProgress += 1;
                    const messages = [
                        'PDF 레이아웃 계산 중...',
                        'PDF 페이지 생성 중...',
                        'PDF 이미지 임베딩 중...',
                        'PDF 폰트 처리 중...',
                        'PDF 최종 렌더링 중...'
                    ];
                    const messageIndex = Math.floor((currentProgress - 80) / 3) % messages.length;
                    this.showPDFProgress(currentProgress, 'PDF 생성 중...', messages[messageIndex]);
                }
            }, 200); // Update every 200ms

            // Step 3: Generate PDF to the selected path
            App.backend.generate_pdf_from_html(renderedHTML, title, savePath, (resultJson) => {
                clearInterval(progressInterval); // Stop fake progress

                const result = JSON.parse(resultJson);

                if (result.success) {
                    this.showPDFProgress(100, '✅ 완료!', `PDF 생성이 완료되었습니다!`);

                    // Add success styling
                    const modalContent = document.querySelector('.modal-content');
                    if (modalContent) {
                        modalContent.classList.add('success', 'complete');
                    }

                    console.log('✅ PDF 생성 성공:', result.filepath);

                    // Show completion message for 2.5 seconds, then hide
                    setTimeout(() => {
                        this.hidePDFProgress();
                        // Remove success classes
                        if (modalContent) {
                            modalContent.classList.remove('success', 'complete');
                        }
                        if (typeof Utils !== 'undefined') {
                            Utils.showToast(`PDF를 생성했습니다\n${result.filepath}`, 'success');
                        }
                    }, 2500);
                } else if (result.error !== 'Cancelled') {
                    clearInterval(progressInterval); // Stop fake progress on error
                    this.hidePDFProgress();
                    console.error('❌ PDF 생성 실패:', result.error);

                    // Provide helpful error messages
                    let errorMessage = 'PDF 생성 실패';
                    if (result.error.includes('GTK3')) {
                        errorMessage = 'GTK3가 필요합니다. README를 참조하여 설치해주세요.';
                    } else if (result.error.includes('WeasyPrint')) {
                        errorMessage = 'WeasyPrint 라이브러리 오류. requirements.txt를 확인해주세요.';
                    } else {
                        errorMessage = `PDF 생성 실패: ${result.error}`;
                    }

                    if (typeof Utils !== 'undefined') {
                        Utils.showToast(errorMessage, 'error');
                    }
                } else {
                    clearInterval(progressInterval); // Stop fake progress on cancel
                    this.hidePDFProgress();
                    console.log('PDF 내보내기 취소됨');
                }
            });
        } catch (error) {
            // Hide progress modal on error
            this.hidePDFProgress();
            console.error('❌ PDF 내보내기 실패:', error);
            if (typeof Utils !== 'undefined') {
                Utils.showToast(`PDF 내보내기 오류: ${error.message}`, 'error');
            }
        }
    },

    /**
     * Export to DOCX
     */
    async exportToDOCX() {
        if (!App.backend) {
            if (typeof Utils !== 'undefined') {
                Utils.showToast('DOCX 내보내기는 앱에서만 사용할 수 있습니다', 'warning');
            }
            return;
        }

        try {
            const content = EditorModule.getContent();
            console.log('📄 DOCX로 내보내기...', content.length, 'characters');

            // Call backend to export to DOCX
            App.backend.export_to_docx(content, (resultJson) => {
                const result = JSON.parse(resultJson);

                if (result.success) {
                    console.log('✅ DOCX 생성 성공:', result.filepath);
                    if (typeof Utils !== 'undefined') {
                        Utils.showToast('DOCX를 생성했습니다', 'success');
                    }
                } else if (result.error !== 'Cancelled') {
                    console.error('❌ DOCX 생성 실패:', result.error);
                    if (typeof Utils !== 'undefined') {
                        Utils.showToast('DOCX 생성 실패: ' + result.error, 'error');
                    }
                }
            });
        } catch (error) {
            console.error('❌ DOCX 내보내기 실패:', error);
            if (typeof Utils !== 'undefined') {
                Utils.showToast('DOCX 내보내기에 실패했습니다', 'error');
            }
        }
    },

    /**
     * Export to HTML
     */
    exportToHTML() {
        if (!App.backend) {
            // Fallback for browser mode
            try {
                const content = PreviewModule.currentContent;
                const blob = new Blob([content], { type: 'text/html' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = 'document.html';
                a.click();

                URL.revokeObjectURL(url);

                if (typeof Utils !== 'undefined') {
                    Utils.showToast('HTML 파일로 내보냈습니다', 'success');
                }
            } catch (error) {
                console.error('❌ HTML 내보내기 실패:', error);
                if (typeof Utils !== 'undefined') {
                    Utils.showToast('HTML 내보내기에 실패했습니다', 'error');
                }
            }
            return;
        }

        try {
            const content = EditorModule.getContent();
            console.log('📄 HTML로 내보내기...');

            // Call backend to export to HTML
            App.backend.export_to_html(content, (resultJson) => {
                const result = JSON.parse(resultJson);

                if (result.success) {
                    console.log('✅ HTML 생성 성공:', result.filepath);
                    if (typeof Utils !== 'undefined') {
                        Utils.showToast('HTML을 생성했습니다', 'success');
                    }
                } else if (result.error !== 'Cancelled') {
                    console.error('❌ HTML 생성 실패:', result.error);
                    if (typeof Utils !== 'undefined') {
                        Utils.showToast('HTML 생성 실패: ' + result.error, 'error');
                    }
                }
            });
        } catch (error) {
            console.error('❌ HTML 내보내기 실패:', error);
            if (typeof Utils !== 'undefined') {
                Utils.showToast('HTML 내보내기에 실패했습니다', 'error');
            }
        }
    },

    /**
     * Import from file
     */
    async importFile(file) {
        try {
            const text = await file.text();
            EditorModule.setContent(text);
            Utils.showToast(`${file.name} 파일을 불러왔습니다`, 'success');
        } catch (error) {
            console.error('❌ 파일 가져오기 실패:', error);
            Utils.showToast('파일 가져오기에 실패했습니다', 'error');
        }
    }
};

import os
import tempfile
import logging
from datetime import datetime
from typing import Dict, Any
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

logger = logging.getLogger(__name__)

class PDFGenerator:
    """Service for generating PDF reports from summary and transcription data"""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        
    def _setup_custom_styles(self):
        """Setup custom paragraph styles for the PDF"""
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1A1A1A'),
            spaceAfter=30,
            alignment=1  # Center
        ))
        
        self.styles.add(ParagraphStyle(
            name='SectionHeading',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#007AFF'),
            spaceAfter=12,
            spaceBefore=20
        ))
        
        self.styles.add(ParagraphStyle(
            name='FieldLabel',
            parent=self.styles['Normal'],
            fontSize=12,
            textColor=colors.HexColor('#6B7280'),
            fontName='Helvetica-Bold'
        ))
        
        self.styles.add(ParagraphStyle(
            name='FieldValue',
            parent=self.styles['Normal'],
            fontSize=12,
            textColor=colors.HexColor('#1A1A1A'),
            spaceAfter=10
        ))
        
    async def generate_report(self, summary: Dict[str, Any], transcription: str) -> str:
        """
        Generate PDF report from summary and transcription
        
        Args:
            summary: Dictionary containing structured summary data
            transcription: Original transcription text
            
        Returns:
            Path to generated PDF file
            
        Raises:
            Exception: If PDF generation fails
        """
        try:
            # Create temporary file for PDF
            temp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
            temp_pdf.close()  # Close to allow ReportLab to write to it
            
            # Create PDF document
            doc = SimpleDocTemplate(
                temp_pdf.name,
                pagesize=letter,
                rightMargin=72,
                leftMargin=72,
                topMargin=72,
                bottomMargin=18,
            )
            
            # Build content
            story = []
            
            # Title
            story.append(Paragraph("Work Report", self.styles['CustomTitle']))
            story.append(Spacer(1, 0.2*inch))
            
            # Report metadata
            metadata_data = [
                ['Report Generated:', datetime.now().strftime('%B %d, %Y at %I:%M %p')],
                ['Report Type:', 'Voice-to-Text Work Summary'],
            ]
            
            metadata_table = Table(metadata_data, colWidths=[2*inch, 4*inch])
            metadata_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#6B7280')),
                ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1A1A1A')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('LINEBELOW', (0, -1), (-1, -1), 1, colors.HexColor('#E5E7EB')),
            ]))
            
            story.append(metadata_table)
            story.append(Spacer(1, 0.5*inch))
            
            # Summary Section
            story.append(Paragraph("Summary", self.styles['SectionHeading']))
            
            # Summary fields - handle both direct dict and nested summary structure
            summary_data = summary.get('summary', summary) if 'summary' in summary else summary
            
            summary_fields = [
                ('Task Description', summary_data.get('taskDescription', 'N/A')),
                ('Location', summary_data.get('location', 'Not specified')),
                ('Date/Time', summary_data.get('datetime', 'Not specified')),
                ('Outcome', summary_data.get('outcome', 'Not specified')),
                ('Additional Notes', summary_data.get('notes', 'None')),
            ]
            
            for label, value in summary_fields:
                if value and value not in ['Not specified', 'None', 'N/A', None]:
                    story.append(Paragraph(label, self.styles['FieldLabel']))
                    story.append(Paragraph(str(value), self.styles['FieldValue']))
            
            story.append(Spacer(1, 0.3*inch))
            
            # Full Transcription Section
            story.append(Paragraph("Full Transcription", self.styles['SectionHeading']))
            
            # Create transcription paragraph with proper text wrapping
            trans_style = ParagraphStyle(
                'Transcription',
                parent=self.styles['Normal'],
                fontSize=11,
                leading=16,
                textColor=colors.HexColor('#374151'),
                borderColor=colors.HexColor('#E5E7EB'),
                borderWidth=1,
                borderPadding=10,
                backgroundColor=colors.HexColor('#F9FAFB')
            )
            
            # Escape any special characters and ensure proper text formatting
            safe_transcription = self._escape_html(transcription)
            story.append(Paragraph(safe_transcription, trans_style))
            
            # Footer
            story.append(Spacer(1, 0.5*inch))
            footer_style = ParagraphStyle(
                'Footer',
                parent=self.styles['Normal'],
                fontSize=9,
                textColor=colors.HexColor('#9CA3AF'),
                alignment=1  # Center
            )
            story.append(Paragraph("Generated by Voice-to-Report AI System", footer_style))
            
            # Build PDF
            doc.build(story)
            
            logger.info(f"PDF generated successfully: {temp_pdf.name}")
            return temp_pdf.name
            
        except Exception as e:
            logger.error(f"PDF generation error: {str(e)}")
            # Clean up temp file if it was created
            if 'temp_pdf' in locals() and os.path.exists(temp_pdf.name):
                try:
                    os.unlink(temp_pdf.name)
                except:
                    pass
            raise Exception(f"PDF generation failed: {str(e)}")
    
    def _escape_html(self, text: str) -> str:
        """
        Escape special characters for ReportLab Paragraph
        """
        if not text:
            return "No transcription available"
            
        # Replace common problematic characters
        replacements = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
            
        return text
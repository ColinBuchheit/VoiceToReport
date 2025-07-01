import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from datetime import datetime
import tempfile
import logging

logger = logging.getLogger(__name__)

class PDFGenerator:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        
    def _setup_custom_styles(self):
        """Setup custom paragraph styles"""
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
        
    async def generate_report(self, summary: dict, transcription: str) -> str:
        """
        Generate PDF report from summary and transcription
        """
        try:
            # Create temporary file for PDF
            temp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
            
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
            
            # Summary fields
            summary_fields = [
                ('Task Description', summary.get('taskDescription', 'N/A')),
                ('Location', summary.get('location', 'Not specified')),
                ('Date/Time', summary.get('datetime', 'Not specified')),
                ('Outcome', summary.get('outcome', 'Not specified')),
                ('Additional Notes', summary.get('notes', 'None')),
            ]
            
            for label, value in summary_fields:
                if value and value != 'Not specified' and value != 'None':
                    story.append(Paragraph(label, self.styles['FieldLabel']))
                    story.append(Paragraph(value, self.styles['FieldValue']))
            
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
            
            story.append(Paragraph(transcription, trans_style))
            
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
            raise
# Updated PDF Generator with Bears&T logo support
import tempfile
import os
from datetime import datetime
from typing import Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
import logging

logger = logging.getLogger(__name__)

class PDFGenerator:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Set up custom styles for the PDF"""
        # Custom title style
        self.styles.add(ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Title'],
            fontSize=28,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor('#1A1A1A'),
            alignment=1,  # Center
            spaceAfter=0.3*inch
        ))
        
        # Section heading style
        self.styles.add(ParagraphStyle(
            'SectionHeading',
            parent=self.styles['Heading2'],
            fontSize=16,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor('#FF6B35'),  # Orange color
            spaceBefore=0.2*inch,
            spaceAfter=0.1*inch
        ))
        
        # Field label style
        self.styles.add(ParagraphStyle(
            'FieldLabel',
            parent=self.styles['Normal'],
            fontSize=12,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor('#FF6B35'),  # Orange color
            spaceBefore=0.15*inch,
            spaceAfter=0.05*inch
        ))
        
        # Field value style
        self.styles.add(ParagraphStyle(
            'FieldValue',
            parent=self.styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor('#1A1A1A'),
            leftIndent=0.2*inch,
            spaceAfter=0.05*inch,
            leading=14
        ))
    
    async def generate_report(self, summary: Dict[str, Any], transcription: str) -> str:
        """
        Generate PDF report from summary and transcription with Bears&T logo
        
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
            
            # Add Bears&T logo if available
            logo_path = self._get_logo_path()
            if logo_path and os.path.exists(logo_path):
                try:
                    logo = Image(logo_path, width=3*inch, height=1.2*inch)
                    logo.hAlign = 'CENTER'
                    story.append(logo)
                    story.append(Spacer(1, 0.3*inch))
                except Exception as e:
                    logger.warning(f"Could not add logo: {e}")
                    # Continue without logo
            
            # Title
            story.append(Paragraph("WORK REPORT", self.styles['CustomTitle']))
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
            story.append(Paragraph("SUMMARY", self.styles['SectionHeading']))
            
            # Add a subtle divider line under the heading
            divider_style = ParagraphStyle(
                'Divider',
                parent=self.styles['Normal'],
                fontSize=1,
                textColor=colors.HexColor('#E5E7EB'),
                spaceAfter=0.2*inch
            )
            story.append(Paragraph("_" * 80, divider_style))
            
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
                if value and value not in ['Not specified', 'None', 'N/A', None, '']:
                    story.append(Paragraph(f"{label}:", self.styles['FieldLabel']))
                    story.append(Paragraph(str(value), self.styles['FieldValue']))
            
            story.append(Spacer(1, 0.4*inch))
            
            # Full Transcription Section
            story.append(Paragraph("FULL TRANSCRIPTION", self.styles['SectionHeading']))
            
            # Add a subtle divider line under the heading
            story.append(Paragraph("_" * 80, divider_style))
            
            # Create clean transcription paragraph without gray box
            trans_style = ParagraphStyle(
                'Transcription',
                parent=self.styles['Normal'],
                fontSize=11,
                leading=16,
                textColor=colors.HexColor('#1A1A1A'),
                leftIndent=0.2*inch,
                spaceAfter=0.2*inch,
                alignment=0  # Left aligned
            )
            
            # Escape any special characters and ensure proper text formatting
            safe_transcription = self._escape_html(transcription)
            story.append(Paragraph(safe_transcription, trans_style))
            
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
    
    def _get_logo_path(self) -> str:
        """
        Get the path to the Bears&T logo file
        Checks multiple possible locations
        """
        possible_paths = [
            # Current directory
            'bears&t.png',
            'logo.png',
            # Assets directory
            'assets/bears&t.png',
            'assets/logo.png',
            # Static directory
            'static/bears&t.png',
            'static/logo.png',
            # Logo directory
            'logos/bears&t.png',
            'logos/logo.png',
            # Backend assets
            'backend/assets/bears&t.png',
            'backend/static/bears&t.png',
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                logger.info(f"Found logo at: {path}")
                return path
        
        logger.warning("Logo file not found in any expected location")
        return None
    
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
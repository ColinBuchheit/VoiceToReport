# backend/services/email_service.py - SLEEK PROFESSIONAL DESIGN
import logging
import smtplib
import base64
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from typing import List, Dict, Any, Union
from datetime import datetime
from email.utils import format_datetime
from config import settings

logger = logging.getLogger(__name__)

class EmailService:
    """Service for sending closeout report emails"""
    
    def __init__(self):
        self.smtp_server = settings.smtp_server
        self.smtp_port = int(settings.smtp_port)
        self.email_user = settings.email_user
        self.email_password = settings.email_password
        
        if settings.email_recipients:
            self.recipients = [email.strip() for email in settings.email_recipients.split(',') if email.strip()]
        else:
            self.recipients = ['colbol42@gmail.com']
        
        logger.info(f"Email service initialized with {len(self.recipients)} recipients: {', '.join(self.recipients)}")
    
    def _safe_get(self, data: Union[Dict[str, Any], object], key: str, default: str = 'Not specified') -> str:
        """Safely get value from either a dictionary or an object with attributes"""
        try:
            if isinstance(data, dict):
                value = data.get(key, default)
            else:
                value = getattr(data, key, default)
            
            if not value or (isinstance(value, str) and not value.strip()):
                return default
            return value.strip() if isinstance(value, str) else str(value)
        except (AttributeError, TypeError):
            return default
    
    def _get_logo_base64(self) -> str:
        """Load and encode the local logo as base64"""
        try:
            logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'bears&t.png')
            if os.path.exists(logo_path):
                with open(logo_path, 'rb') as f:
                    logo_data = base64.b64encode(f.read()).decode('utf-8')
                    logger.info(f"✅ Logo loaded successfully from {logo_path}")
                    return f"data:image/png;base64,{logo_data}"
            else:
                logger.warning(f"⚠️ Logo not found at {logo_path}, using fallback")
                return "https://via.placeholder.com/200x80/000000/FF6B35?text=Bear+Techs"
        except Exception as e:
            logger.error(f"❌ Failed to load logo: {e}")
            return "https://via.placeholder.com/200x80/000000/FF6B35?text=Bear+Techs"
    
    def get_recipients(self) -> List[str]:
        """Get current list of email recipients"""
        return self.recipients.copy()
    
    def format_closeout_email_html(self, closeout_data: Union[Dict[str, Any], object], transcription: str, technician_name: str = None, logo_src_override: str = None) -> str:
        """Format closeout data into a sleek, professional HTML email inspired by Stripe/Notion"""
        
        timestamp = datetime.now().strftime("%B %d, %Y")

        # Get work order
        work_order = None
        for field_name in ['work_order', 'workOrder', 'work_order_number']:
            work_order = self._safe_get(closeout_data, field_name, None)
            if work_order and work_order != 'Not specified':
                break

        if not work_order or work_order == 'Not specified':
            work_order = 'Not Specified'

        logger.info(f"📋 Work Order for email: '{work_order}'")

        tech_name = technician_name or self._safe_get(closeout_data, 'technician_name', None)
        logo_src = logo_src_override or self._get_logo_base64()

        # Define field groups with clean organization
        field_groups = [
            {
                "title": "Service Summary",
                "fields": [
                    ("onsite_contact", "On-Site Contact"),
                    ("support_contact", "Support Contact"),
                    ("work_completed", "Work Completed"),
                    ("scope_completed", "Scope Status"),
                ]
            },
            {
                "title": "Technical Information",
                "fields": [
                    ("delays", "Delays & Issues"),
                    ("troubleshooting_steps", "Troubleshooting Steps"),
                ]
            },
            {
                "title": "Closeout Details",
                "fields": [
                    ("released_by", "Released By"),
                    ("release_code", "Release Code"),
                    ("return_tracking", "Return Tracking"),
                ]
            },
            {
                "title": "Resources",
                "fields": [
                    ("photos_uploaded", "Photos Uploaded"),
                    ("expenses", "Expenses"),
                    ("materials_used", "Materials Used"),
                ]
            },
            {
                "title": "Additional Notes",
                "fields": [
                    ("out_of_scope_work", "Out of Scope Work"),
                    ("additional_notes", "Notes"),
                ]
            },
        ]
        
        # Build field sections
        sections_html = ""
        for group in field_groups:
            group_html = ""
            has_content = False
            
            # Check if this group has content
            for field_name, _ in group["fields"]:
                value = self._safe_get(closeout_data, field_name)
                if value and value != 'Not specified':
                    has_content = True
                    break
            
            if not has_content:
                continue
            
            # Add section title
            group_html += f"""
            <tr>
                <td style="padding: 32px 0 16px 0;">
                    <h2 style="margin: 0; font-size: 13px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em;">{group["title"]}</h2>
                </td>
            </tr>
            """
            
            # Add fields
            for field_name, label in group["fields"]:
                value = self._safe_get(closeout_data, field_name)
                if value and value != 'Not specified':
                    group_html += f"""
            <tr>
                <td style="padding: 0 0 16px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px;">
                        <tr>
                            <td style="padding: 16px 20px;">
                                <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 6px; letter-spacing: 0.01em;">{label}</div>
                                <div style="font-size: 14px; line-height: 1.6; color: #111827;">{value}</div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
                    """
            
            sections_html += group_html
        
        # Build transcription section
        transcription_html = ""
        if transcription and transcription.strip() and transcription != 'Not specified':
            transcription_html = f"""
            <tr>
                <td style="padding: 32px 0 16px 0;">
                    <h2 style="margin: 0; font-size: 13px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em;">Voice Transcription</h2>
                </td>
            </tr>
            <tr>
                <td style="padding: 0 0 16px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px;">
                        <tr>
                            <td style="padding: 16px 20px;">
                                <div style="font-size: 14px; line-height: 1.7; color: #4B5563; font-style: italic;">{transcription}</div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            """
        
        html_body = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta name="x-apple-disable-message-reformatting">
            <meta name="color-scheme" content="light dark">
            <meta name="supported-color-schemes" content="light dark">
            <title>Field Service Closeout Report</title>
            <style>
                :root {{
                    color-scheme: light dark;
                    supported-color-schemes: light dark;
                }}
                
                @media (prefers-color-scheme: dark) {{
                    .email-bg {{
                        background-color: #0A0A0A !important;
                    }}
                    .card-bg {{
                        background-color: #1A1A1A !important;
                        border-color: #2A2A2A !important;
                    }}
                    .header-bg {{
                        background-color: #1A1A1A !important;
                        border-bottom-color: #2A2A2A !important;
                    }}
                    .section-title {{
                        color: #A1A1AA !important;
                    }}
                    .field-card {{
                        background-color: #262626 !important;
                        border-color: #3A3A3A !important;
                    }}
                    .field-label {{
                        color: #D4D4D8 !important;
                    }}
                    .field-value {{
                        color: #FAFAFA !important;
                    }}
                    .timestamp-text {{
                        color: #71717A !important;
                    }}
                    .footer-bg {{
                        background-color: #1A1A1A !important;
                        border-top-color: #2A2A2A !important;
                    }}
                    .footer-text {{
                        color: #71717A !important;
                    }}
                    .wo-badge {{
                        background-color: #FF6B35 !important;
                        color: #FFFFFF !important;
                    }}
                    .tech-badge {{
                        background-color: #2A2A2A !important;
                        color: #D4D4D8 !important;
                        border-color: #3A3A3A !important;
                    }}
                }}
            </style>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-text-size-adjust: 100%; line-height: 1.5;">
            <table role="presentation" class="email-bg" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F3F4F6;">
                <tr>
                    <td align="center" style="padding: 40px 20px;">
                        <table role="presentation" class="card-bg" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);">
                            
                            <!-- Header -->
                            <tr>
                                <td class="header-bg" style="padding: 32px 32px 24px 32px; background-color: #FFFFFF; border-bottom: 1px solid #E5E7EB;">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                        <tr>
                                            <td align="center" style="padding-bottom: 20px;">
                                                <img src="{logo_src}" alt="Bear Techs" width="140" style="height: auto; display: block; border: 0;">
                                            </td>
                                        </tr>
                                        <tr>
                                            <td align="center">
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                                                    <tr>
                                                        <td>
                                                            <div class="wo-badge" style="display: inline-block; background-color: #FF6B35; color: #FFFFFF; padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; letter-spacing: 0.01em;">
                                                                Work Order: {work_order}
                                                            </div>
                                                        </td>
                                                        {"<td style='padding-left: 8px;'><div class='tech-badge' style='display: inline-block; background-color: #F3F4F6; color: #374151; padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; border: 1px solid #E5E7EB;'>" + tech_name + "</div></td>" if tech_name and tech_name != 'Not specified' else ""}
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Timestamp Bar -->
                            <tr>
                                <td style="padding: 16px 32px; background-color: #F9FAFB; border-bottom: 1px solid #E5E7EB;">
                                    <span class="timestamp-text" style="font-size: 13px; color: #6B7280;">Report Generated: {timestamp}</span>
                                </td>
                            </tr>

                            <!-- Main Content -->
                            <tr>
                                <td style="padding: 8px 32px 32px 32px;">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                        {sections_html}
                                        {transcription_html}
                                    </table>
                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td class="footer-bg" style="padding: 24px 32px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; text-align: center;">
                                    <div class="footer-text" style="font-size: 12px; color: #9CA3AF; line-height: 1.5;">
                                        Bear Techs Field Service<br>
                                        Automated Voice-to-Report System
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        return html_body
    
    def send_closeout_email(self, closeout_data: Union[Dict[str, Any], object], transcription: str, technician_name: str = None) -> Dict[str, Any]:
        """Send the closeout email to the specified recipients"""
        
        try:
            if not self.email_user or not self.email_password:
                logger.error("Email credentials not configured")
                return {"success": False, "message": "Email credentials not configured", "recipients": []}
            
            if not self.recipients:
                logger.error("No email recipients configured")
                return {"success": False, "message": "No recipients configured", "recipients": []}
            
            logger.info(f"Sending closeout email to {len(self.recipients)} recipients")
            
            # Get work order
            work_order = None
            for field_name in ['work_order', 'workOrder', 'work_order_number']:
                work_order = self._safe_get(closeout_data, field_name, None)
                if work_order and work_order != 'Not specified':
                    break
            
            if not work_order or work_order == 'Not specified':
                work_order = 'Not Specified'
            
            logger.info(f"📋 Subject line work order: '{work_order}'")
            
            # Build subject line
            timestamp = datetime.now().strftime("%Y-%m-%d")
            tech_name_for_subject = technician_name or self._safe_get(closeout_data, 'technician_name', None)

            subject = (f"Field Service Closeout - WO: {work_order} - {tech_name_for_subject} - {timestamp}" 
                       if tech_name_for_subject and tech_name_for_subject != 'Not specified' 
                       else f"Field Service Closeout - WO: {work_order} - {timestamp}")

            logger.info(f"📧 Email Subject: {subject}")

            # Generate HTML with inline logo reference
            html_body = self.format_closeout_email_html(closeout_data, transcription, technician_name, logo_src_override='cid:bear_logo')

            # Create multipart message
            msg = MIMEMultipart('related')
            msg['From'] = self.email_user
            msg['To'] = ', '.join(self.recipients)
            try:
                msg['Date'] = format_datetime(datetime.now())
            except Exception:
                msg['Date'] = datetime.now().strftime('%a, %d %b %Y %H:%M:%S')
            msg['Subject'] = subject

            # Attach HTML
            alternative = MIMEMultipart('alternative')
            html_part = MIMEText(html_body, 'html')
            alternative.attach(html_part)
            msg.attach(alternative)

            # Attach inline logo
            try:
                logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'bears&t.png')
                if os.path.exists(logo_path):
                    with open(logo_path, 'rb') as f:
                        img = MIMEImage(f.read())
                        img.add_header('Content-ID', '<bear_logo>')
                        img.add_header('Content-Disposition', 'inline', filename=os.path.basename(logo_path))
                        msg.attach(img)
                        logger.info(f"📎 Attached inline logo from {logo_path}")
                else:
                    logger.warning(f"⚠️ Logo file not found at {logo_path}")
            except Exception as e:
                logger.warning(f"⚠️ Failed to attach inline logo: {e}")
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.set_debuglevel(1)
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(self.email_user, self.email_password)
                server.send_message(msg)
                logger.info(f"✅ Email sent successfully to {len(self.recipients)} recipients")
            
            return {
                "success": True,
                "message": "Email sent successfully",
                "recipients": self.recipients
            }
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return {
                "success": False,
                "message": f"Failed to send email: {str(e)}",
                "recipients": []
            }
    
    def test_email_connection(self) -> Dict[str, Any]:
        """Test the email configuration and connection"""
        try:
            if not self.email_user or not self.email_password:
                return {
                    "status": "error",
                    "message": "Email credentials not configured"
                }
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(self.email_user, self.email_password)
            
            return {
                "status": "success",
                "message": "Email configuration is valid",
                "smtp_server": self.smtp_server,
                "smtp_port": self.smtp_port,
                "recipients": self.recipients
            }
        except Exception as e:
            logger.error(f"Email connection test failed: {e}")
            return {
                "status": "error",
                "message": f"Email connection test failed: {str(e)}"
            }
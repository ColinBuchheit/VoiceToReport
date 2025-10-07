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

        location_name = self._safe_get(closeout_data, 'location', None)
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
        
        # Build field sections with modern card style (accent left border, subtle shadow)
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

            # Section title
            group_html += f"""
            <tr>
                <td style="padding: 28px 0 12px 0;">
                    <h2 class="section-title" style="margin:0; font-size:12px; font-weight:700; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.08em;">{group['title']}</h2>
                </td>
            </tr>
            """

            # Fields as cards
            for field_name, label in group["fields"]:
                value = self._safe_get(closeout_data, field_name)
                if value and value != 'Not specified':
                    group_html += f"""
            <tr>
                <td style="padding: 8px 0 12px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="field-card" style="width:100%; background-color:#FFFFFF; border-radius:10px; border:1px solid #ECEFF1; box-shadow:0 2px 8px rgba(12,12,12,0.04);">
                        <tr>
                            <td style="padding:14px 16px;">
                                <div class="field-label" style="font-size:12px; font-weight:700; color:#374151; margin-bottom:6px;">{label}</div>
                                <div class="field-value" style="font-size:14px; line-height:1.6; color:#0B0B0B;">{value}</div>
                            </td>
                            <td width="8" style="width:8px;"></td>
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
                <td style="padding: 20px 0 12px 0;">
                    <h2 class="section-title" style="margin:0; font-size:12px; font-weight:700; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.08em;">Voice Transcription</h2>
                </td>
            </tr>
            <tr>
                <td style="padding: 8px 0 16px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#FFF9F6; border:1px solid #FFE9DA; border-radius:10px;">
                        <tr>
                            <td style="padding:14px 16px;">
                                <div style="font-size:14px; line-height:1.7; color:#374151; font-style:normal;">{transcription}</div>
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
                /* Core color scheme: Black / White / Orange */
                :root {{
                    color-scheme: light dark;
                    supported-color-schemes: light dark;
                }}

                /* Desktop / client-friendly adjustments */
                .section-title {{ color: #9CA3AF; }}
                .field-card {{ background-color: #FFFFFF; border:1px solid #ECEFF1; }}
                .field-label {{ color: #374151; }}
                .field-value {{ color: #0B0B0B; }}
                .timestamp-text {{ color: #9CA3AF; }}
                .footer-text {{ color: #9CA3AF; }}
                .wo-badge {{ background-color: #FF6B35; color:#FFFFFF; }}
                .tech-badge {{ background-color:#F7F7F8; color:#374151; border:1px solid #ECEFF1; }}

                @media (prefers-color-scheme: dark) {{
                    .email-bg {{ background-color:#080808 !important; }}
                    .card-bg {{ background-color:#0B0B0B !important; border-color:#1A1A1A !important; color:#E6E6E6 !important; }}
                    .header-bg {{ background-color:#0B0B0B !important; border-bottom-color:#1A1A1A !important; }}
                    .section-title {{ color:#9CA3AF !important; }}
                    .field-card {{ background-color:#111111 !important; border-color:#222222 !important; box-shadow:none !important; }}
                    .field-label {{ color:#E6E6E6 !important; }}
                    .field-value {{ color:#FFFFFF !important; }}
                    .timestamp-text {{ color:#8B8B8B !important; }}
                    .footer-text {{ color:#8B8B8B !important; }}
                    .wo-badge {{ background-color:#FF6B35 !important; }}
                    .tech-badge {{ background-color:#121212 !important; border-color:#222 !important; color:#D1D1D1 !important; }}
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
                                    <td class="header-bg" style="padding: 28px 28px 22px 28px; background-color: #0B0B0B; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                        <tr>
                                            <td align="center" style="padding-bottom: 20px;">
                                                <img src="{logo_src}" alt="Bear Techs" width="150" style="height: auto; display: block; border: 0;">
                                            </td>
                                        </tr>
                                        <tr>
                                            <td align="center">
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                                                    <tr>
                                                        <td>
                                                            <div class="wo-badge" style="display: inline-block; background-color: #FF6B35; color: #FFFFFF; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight:700; letter-spacing:0.01em;">
                                                                {location_name if location_name and location_name != 'Not specified' else 'Location'} · WO {work_order}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Timestamp Bar -->
                            <tr>
                                <td style="padding: 14px 28px; background-color: #F7F7F8; border-bottom: 1px solid #ECEFF1;">
                                    <span class="timestamp-text" style="font-size:13px; color:#9CA3AF;">Report Generated: {timestamp}</span>
                                </td>
                            </tr>

                            <!-- Main Content -->
                            <tr>
                                <td style="padding: 18px 28px 28px 28px;">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                        {sections_html}
                                        {transcription_html}
                                    </table>
                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td class="footer-bg" style="padding: 20px 28px; background-color: #F7F7F8; border-top: 1px solid #ECEFF1; text-align: center;">
                                    <div class="footer-text" style="font-size:12px; color:#9CA3AF; line-height:1.5;">
                                        Bear Techs Field Service · Automated Voice-to-Report System
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
    
    def send_closeout_email(self, closeout_data: Union[Dict[str, Any], object], transcription: str, technician_name: str = None, technician_email: str = None) -> Dict[str, Any]:
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
            location_name = self._safe_get(closeout_data, 'location', None)
            subject = (f"{location_name} - WO {work_order}" if location_name and location_name != 'Not specified' 
                       else f"WO {work_order} - {timestamp}")

            logger.info(f"📧 Email Subject: {subject}")

            # Generate HTML with inline logo reference
            html_body = self.format_closeout_email_html(closeout_data, transcription, technician_name, logo_src_override='cid:bear_logo')

            # Create multipart message
            msg = MIMEMultipart('related')
            msg['From'] = self.email_user
            final_recipients = self.recipients.copy()
            if technician_email:
                # avoid duplicate
                if technician_email not in final_recipients:
                    final_recipients.append(technician_email)
            msg['To'] = ', '.join(final_recipients)
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
                logger.info(f"✅ Email sent successfully to {len(final_recipients)} recipients (including technician CC if provided)")
            
            return {
                "success": True,
                "message": "Email sent successfully",
                "recipients": final_recipients
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
# backend/services/email_service.py - COMPLETE WITH ALL 13 FIELDS
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
        """Format the closeout data into a mobile-friendly HTML email with chromatic aberration"""
        
        timestamp = datetime.now().strftime("%B %d, %Y at %I:%M %p")

        # CRITICAL FIX: Get work order
        work_order = None
        for field_name in ['work_order', 'workOrder', 'work_order_number']:
            work_order = self._safe_get(closeout_data, field_name, None)
            if work_order and work_order != 'Not specified':
                break

        if not work_order or work_order == 'Not specified':
            work_order = 'Not Specified'

        logger.info(f"📋 Work Order for email: '{work_order}'")

        tech_name = technician_name or self._safe_get(closeout_data, 'technician_name', None)
        # Allow caller to override logo_src (e.g. 'cid:bear_logo') so we can attach inline images
        logo_src = logo_src_override or self._get_logo_base64()

        def get_field_style(value):
            if value and value != 'Not specified':
                return 'border-left: 4px solid #FF6B35; background: linear-gradient(90deg, #fff5f0 0%, #ffffff 100%);'
            return 'border-left: 4px solid #e0e0e0; background-color: #f8f9fa;'
        
        # Build technician row
        technician_row = ''
        if tech_name and tech_name != 'Not specified':
            technician_row = f"""
                            <p style="margin: 0 0 5px 0; color: #212529; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 14px; line-height: 1.5;">
                                <strong>Technician:</strong> {tech_name}
                            </p>"""
        
        # Build all 13 fields
        fields_html = ""
        
        fields = [
            ("onsite_contact", "WHO DID YOU MEET WITH ON-SITE?"),
            ("support_contact", "WHO DID YOU WORK WITH FOR SUPPORT?"),
            ("work_completed", "WHAT WORK WAS COMPLETED?"),
            ("delays", "WERE THERE ANY DELAYS?"),
            ("troubleshooting_steps", "WHAT TROUBLESHOOTING STEPS DID YOU TAKE?"),
            ("scope_completed", "WAS THE SCOPE COMPLETED SUCCESSFULLY?"),
            ("released_by", "WHO RELEASED YOU?"),
            ("release_code", "IS THERE A RELEASE CODE? IF SO, WHAT IS IT?"),
            ("return_tracking", "IS THERE A RETURN TRACKING NUMBER? IF SO, WHAT IS IT?"),
        ]
        
        for field_name, label in fields:
            value = self._safe_get(closeout_data, field_name)
            fields_html += f"""
                    <tr>
                        <td style="padding: 18px 25px;">
                            <p style="margin: 0 0 8px 0; color: #FF6B35; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">
                                {label}
                            </p>
                            <div style="color: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; line-height: 1.6; padding: 14px 18px; border-radius: 8px; {get_field_style(value)} box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
                                {value}
                            </div>
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
                <title>Field Service Closeout Report</title>
            </head>
            <body style="margin:0;padding:0;background-color:#f4f6f8;color:#111;font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                        <td align="center" style="padding:24px 12px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;width:100%;">
                                <tr>
                                    <td style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e6e9eb;">
                                        <!-- Header: white background so logo is visible in dark mode clients -->
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="padding:20px 24px;background:#ffffff;text-align:center;">
                                                    <div style="display:inline-block;padding:6px;border-radius:10px;background:#ffffff;">
                                                        <img src="{logo_src}" alt="Bear Techs" width="160" style="height:auto;display:block;border:0;" />
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:0 24px 18px 24px;text-align:center;">
                                                    <div style="display:inline-block;padding:8px 14px;background:#FF6B35;color:#ffffff;border-radius:20px;font-weight:700;font-size:14px;">WO: {work_order}</div>
                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Body content -->
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="padding:18px 24px 8px 24px;">
                                                    <p style="margin:0 0 8px 0;color:#6b7280;font-size:13px;">Generated: {timestamp}</p>
                                                </td>
                                            </tr>

                                            <!-- Fields grid -->
                                            <tr>
                                                <td style="padding:0 24px 18px 24px;">
                                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                                        {fields_html}
                                                    </table>
                                                </td>
                                            </tr>

                                            <!-- Expenses & Materials -->
                                            <tr>
                                                <td style="padding:0 24px 18px 24px;">
                                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                                        <tr><td style="padding:8px 0 0 0;font-weight:700;color:#FF6B35;font-size:12px;text-transform:uppercase;">Expenses</td></tr>
                                                        <tr><td style="padding:8px 0;">{self._safe_get(closeout_data,'expenses')}</td></tr>
                                                        <tr><td style="padding:8px 0 0 0;font-weight:700;color:#FF6B35;font-size:12px;text-transform:uppercase;">Materials Used</td></tr>
                                                        <tr><td style="padding:8px 0 18px 0;">{self._safe_get(closeout_data,'materials_used')}</td></tr>
                                                    </table>
                                                </td>
                                            </tr>

                                            <!-- Photos count and transcription -->
                                            <tr>
                                                <td style="padding:0 24px 18px 24px;">
                                                    <div style="padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #eef2f7;">
                                                        <div style="font-weight:700;color:#111;margin-bottom:6px;">Photos uploaded</div>
                                                        <div style="color:#334155;">{self._safe_get(closeout_data,'photos_uploaded')}</div>
                                                    </div>
                                                </td>
                                            </tr>

                                            <tr>
                                                <td style="padding:0 24px 24px 24px;">
                                                    <div style="padding:14px;background:#0f172a;color:#e6eef8;border-radius:8px;font-family:monospace;font-size:13px;white-space:pre-wrap;">{transcription}</div>
                                                </td>
                                            </tr>

                                            <!-- Footer -->
                                            <tr>
                                                <td style="padding:18px 24px 24px 24px;text-align:center;color:#94a3b8;font-size:12px;">
                                                    <div>Field Service App - Automated Voice-to-Report System</div>
                                                </td>
                                            </tr>
                                        </table>
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
            
            # Build a multipart/related message so we can attach an inline image (CID)
            timestamp = datetime.now().strftime("%Y-%m-%d")
            tech_name_for_subject = technician_name or self._safe_get(closeout_data, 'technician_name', None)

            subject = (f"Field Service Closeout - WO: {work_order} - {tech_name_for_subject} - {timestamp}" 
                       if tech_name_for_subject and tech_name_for_subject != 'Not specified' 
                       else f"Field Service Closeout - WO: {work_order} - {timestamp}")

            logger.info(f"📧 Email Subject: {subject}")

            # Ask HTML generator to reference the inline image via cid:bear_logo
            html_body = self.format_closeout_email_html(closeout_data, transcription, technician_name, logo_src_override='cid:bear_logo')

            # root message container
            msg = MIMEMultipart('related')
            msg['From'] = self.email_user
            msg['To'] = ', '.join(self.recipients)
            try:
                msg['Date'] = format_datetime(datetime.now())
            except Exception:
                msg['Date'] = datetime.now().strftime('%a, %d %b %Y %H:%M:%S')
            msg['Subject'] = subject

            # alternative part for HTML (and potential plaintext)
            alternative = MIMEMultipart('alternative')
            html_part = MIMEText(html_body, 'html')
            alternative.attach(html_part)
            msg.attach(alternative)

            # Attach inline logo if available (CID: bear_logo)
            try:
                logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'bears&t.png')
                if os.path.exists(logo_path):
                    with open(logo_path, 'rb') as f:
                        img = MIMEImage(f.read())
                        img.add_header('Content-ID', '<bear_logo>')
                        img.add_header('Content-Disposition', 'inline', filename=os.path.basename(logo_path))
                        msg.attach(img)
                        logger.info(f"� Attached inline logo from {logo_path}")
                else:
                    logger.warning(f"⚠️ Logo file not found at {logo_path}, not attaching inline image")
            except Exception as e:
                logger.warning(f"⚠️ Failed to attach inline logo: {e}")
            
            # Connect and send email with explicit EHLO/STARTTLS and debug logging
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                # Enable SMTP protocol debug output (temporary - useful for tracing)
                try:
                    server.set_debuglevel(1)
                except Exception:
                    pass

                # EHLO/STARTTLS handshake sequence
                try:
                    server.ehlo()
                except Exception:
                    logger.debug("SMTP EHLO failed (continuing)")

                server.starttls()

                try:
                    server.ehlo()
                except Exception:
                    logger.debug("SMTP EHLO after STARTTLS failed (continuing)")

                server.login(self.email_user, self.email_password)

                # Log timing for send to help identify delays
                send_start = datetime.now()
                logger.info(f"⏱️ Starting SMTP send at {send_start.isoformat()}")

                server.send_message(msg)

                send_end = datetime.now()
                duration = (send_end - send_start).total_seconds()
                logger.info(f"⏱️ SMTP send completed at {send_end.isoformat()} (duration {duration:.3f}s)")
            
            logger.info(f"✅ Closeout email sent successfully")
            return {"success": True, "message": "Email sent successfully", "recipients": self.recipients}
            
        except Exception as e:
            logger.error(f"❌ Failed to send closeout email: {str(e)}")
            return {"success": False, "message": f"Failed to send email: {str(e)}", "recipients": []}
    
    def test_email_connection(self) -> Dict[str, Any]:
        """Test email configuration and connection"""
        try:
            if not self.email_user or not self.email_password:
                return {"status": "error", "message": "Email credentials not configured"}
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.email_user, self.email_password)
            
            return {
                "status": "success",
                "message": "Email configuration is valid",
                "smtp_server": self.smtp_server,
                "smtp_port": self.smtp_port,
                "recipients": self.recipients,
                "sender": self.email_user
            }
        except Exception as e:
            return {"status": "error", "message": f"Email connection failed: {str(e)}"}
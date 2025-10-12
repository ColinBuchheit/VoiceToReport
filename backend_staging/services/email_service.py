# backend/services/email_service.py - SLEEK PROFESSIONAL DESIGN
import logging
import smtplib
import ssl
import certifi
import base64
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.mime.base import MIMEBase
from email import encoders
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
            self.recipients = []
        
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
    
    def format_closeout_email_html(self, closeout_data: Union[Dict[str, Any], object], transcription: str, technician_name: str = None, technician_email: str = None, logo_src_override: str = None) -> str:
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
        # Normalize placeholders
        if tech_name in (None, '', 'Not specified', 'Not mentioned'):
            tech_name = None

        # Clean technician email
        if technician_email:
            technician_email = technician_email.strip()
        if technician_email in (None, '', 'Not specified', 'Not mentioned'):
            technician_email = None
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
        
        # Build copy/paste consolidated summary (flat text)
        # Iterate same field_groups used above to keep ordering consistent
        copy_lines = []
        # Add technician details first
        if tech_name or technician_email:
            if tech_name and technician_email:
                copy_lines.append(f"Technician Info: {tech_name} ({technician_email})")
            elif tech_name:
                copy_lines.append(f"Technician Info: {tech_name}")
            else:
                copy_lines.append(f"Technician Info: {technician_email}")
        if location_name and location_name != 'Not specified':
            copy_lines.append(f"Location: {location_name}")
        if work_order and work_order != 'Not Specified':
            copy_lines.append(f"Work Order: {work_order}")
        for group in field_groups:
            for field_name, label in group["fields"]:
                value = self._safe_get(closeout_data, field_name)
                if value and value != 'Not specified':
                    copy_lines.append(f"{label}: {value}")
        if transcription and transcription.strip() and transcription != 'Not specified':
            copy_lines.append("Transcription: " + transcription.strip())

        copy_block_text = ("\n".join(copy_lines)).replace('<', '⟨').replace('>', '⟩')  # avoid unintended HTML rendering

        copy_paste_html = f"""
            <tr>
                <td style="padding: 28px 0 12px 0;">
                    <h2 class=\"section-title\" style=\"margin:0; font-size:12px; font-weight:700; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.08em;\">Copy/Paste Summary</h2>
                </td>
            </tr>
            <tr>
                <td style=\"padding: 8px 0 16px 0;\">
                    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" style=\"background-color:#F7F7F8; border:1px solid #ECEFF1; border-radius:10px;\">
                        <tr>
                            <td style=\"padding:14px 16px;\">
                                <div style=\"font-family:Menlo,Consolas,'Courier New',monospace; font-size:12px; line-height:1.55; white-space:pre-wrap; color:#374151;\">{copy_block_text}</div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        """

        # Header technician badge (if available)
        technician_badge_html = ""
        if tech_name or technician_email:
            tech_label_parts = []
            if tech_name:
                tech_label_parts.append(tech_name)
            if technician_email:
                tech_label_parts.append(f"<span style=\"color:#6B7280;\">{technician_email}</span>")
            # Build labeled technician info string
            tech_label = f"<strong>Technician Info:</strong> " + " · ".join(tech_label_parts)
            technician_badge_html = f"""
                <tr>
                    <td align=\"center\" style=\"padding-top:14px;\">
                        <div class=\"tech-badge\" style=\"display:inline-block; background-color:#F7F7F8; color:#374151; padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600; border:1px solid #ECEFF1;\">
                            {tech_label}
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
                                                        <td style="text-align:center;">
                                                            <div class="wo-badge" style="display: inline-block; background-color: #FF6B35; color: #FFFFFF; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight:700; letter-spacing:0.01em;">
                                                                {location_name if location_name and location_name != 'Not specified' else 'Location'} · WO {work_order}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {technician_badge_html}
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
                                        {copy_paste_html}
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
            html_body = self.format_closeout_email_html(
                closeout_data,
                transcription,
                technician_name,
                technician_email,
                logo_src_override='cid:bear_logo'
            )

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
            msg['X-Template-Version'] = 'v2-html-2025-10-11'

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
            context = ssl.create_default_context(cafile=certifi.where())
            # Optionally load additional CA bundle (corp proxy)
            try:
                ca_bundle = getattr(settings, 'smtp_ca_bundle', None)
                # Auto-detect a default CA path on Azure if none provided
                if not ca_bundle:
                    default_ca = '/home/site/wwwroot/certs/smtp-ca.pem'
                    if os.path.exists(default_ca):
                        ca_bundle = default_ca
                if ca_bundle:
                    context.load_verify_locations(cafile=ca_bundle)
                    logger.info(f"Loaded custom CA bundle: {ca_bundle}")
            except Exception as ca_err:
                logger.warning(f"Could not load custom CA bundle: {ca_err}")
            # Dev-only insecure toggle
            try:
                # Never allow insecure in production/Azure
                is_prod = False
                try:
                    env = str(getattr(settings, 'environment', '')).lower()
                    if env == 'production':
                        is_prod = True
                except Exception:
                    pass
                if os.getenv('WEBSITE_INSTANCE_ID'):
                    is_prod = True

                if getattr(settings, 'smtp_tls_insecure', False) and not is_prod:
                    context.check_hostname = False
                    context.verify_mode = ssl.CERT_NONE
                    logger.warning("SMTP TLS verification DISABLED (smtp_tls_insecure=true)")
                elif getattr(settings, 'smtp_tls_insecure', False) and is_prod:
                    logger.warning("Ignoring smtp_tls_insecure in production environment")
            except Exception:
                pass
            # Support explicit TLS (587) and implicit TLS/SSL (465)
            if str(self.smtp_port) == '465':
                with smtplib.SMTP_SSL(self.smtp_server, int(self.smtp_port), timeout=20, context=context) as server:
                    server.set_debuglevel(1)
                    logger.info(f"📧 Connecting via SMTPS (SSL) {self.smtp_server}:{self.smtp_port} ...")
                    code, banner = server.ehlo()
                    logger.info(f"📧 EHLO (SSL): {code} {banner}")
                    logger.info("🔑 Logging in to SMTP server (SSL)...")
                    server.login(self.email_user, self.email_password)
                    logger.info("📤 Sending email message via SMTPS...")
                    server.send_message(msg)
            else:
                # STARTTLS flow (typically port 587)
                with smtplib.SMTP(self.smtp_server, int(self.smtp_port), timeout=20) as server:
                    server.set_debuglevel(1)
                    logger.info(f"📧 Connecting to SMTP {self.smtp_server}:{self.smtp_port} ...")
                    code, banner = server.ehlo()
                    logger.info(f"📧 EHLO: {code} {banner}")
                    code, tls_resp = server.starttls(context=context)
                    logger.info(f"🔐 STARTTLS: {code} {tls_resp}")
                    code, post_ehlo = server.ehlo()
                    logger.info(f"📧 EHLO (post-TLS): {code} {post_ehlo}")
                    logger.info("🔑 Logging in to SMTP server...")
                    server.login(self.email_user, self.email_password)
                    logger.info("📤 Sending email message via SMTP...")
                    server.send_message(msg)
                logger.info(f"✅ Email sent successfully to {len(final_recipients)} recipients (including technician CC if provided)")
            
            return {
                "success": True,
                "message": "Email sent successfully",
                "recipients": final_recipients
            }
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP auth failed: {e}")
            hint = ("Authentication failed. If using Gmail, enable 'App Passwords' with 2FA and use that password, "
                    "or ensure 'Less secure app access' (deprecated) is not required.")
            return {
                "success": False,
                "message": f"SMTP authentication failed: {str(e)}. {hint}",
                "recipients": []
            }
        except smtplib.SMTPServerDisconnected as e:
            logger.error(f"SMTP server disconnected unexpectedly: {e}")
            return {
                "success": False,
                "message": "SMTP server disconnected unexpectedly during send (STARTTLS or idle timeout).",
                "recipients": []
            }
        except (smtplib.SMTPConnectError, smtplib.SMTPHeloError, smtplib.SMTPException, TimeoutError) as e:
            logger.error(f"SMTP error: {e}")
            return {
                "success": False,
                "message": f"SMTP error while sending email: {str(e)}",
                "recipients": []
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

            context = ssl.create_default_context(cafile=certifi.where())
            try:
                ca_bundle = getattr(settings, 'smtp_ca_bundle', None)
                if not ca_bundle:
                    default_ca = '/home/site/wwwroot/certs/smtp-ca.pem'
                    if os.path.exists(default_ca):
                        ca_bundle = default_ca
                if ca_bundle:
                    context.load_verify_locations(cafile=ca_bundle)
                    logger.info(f"Loaded custom CA bundle: {ca_bundle}")
            except Exception as ca_err:
                logger.warning(f"Could not load custom CA bundle: {ca_err}")
            try:
                is_prod = False
                try:
                    env = str(getattr(settings, 'environment', '')).lower()
                    if env == 'production':
                        is_prod = True
                except Exception:
                    pass
                if os.getenv('WEBSITE_INSTANCE_ID'):
                    is_prod = True

                if getattr(settings, 'smtp_tls_insecure', False) and not is_prod:
                    context.check_hostname = False
                    context.verify_mode = ssl.CERT_NONE
                    logger.warning("SMTP TLS verification DISABLED (smtp_tls_insecure=true)")
                elif getattr(settings, 'smtp_tls_insecure', False) and is_prod:
                    logger.warning("Ignoring smtp_tls_insecure in production environment")
            except Exception:
                pass
            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=15) as server:
                code, banner = server.ehlo()
                logger.info(f"📧 Test EHLO: {code} {banner}")
                code, tls_resp = server.starttls(context=context)
                logger.info(f"🔐 Test STARTTLS: {code} {tls_resp}")
                code, post = server.ehlo()
                logger.info(f"📧 Test EHLO (post-TLS): {code} {post}")
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

    def send_bug_report(self, description: str, reporter_email: str | None = None, images: List[Dict[str, str]] | None = None) -> Dict[str, Any]:
        """Send a bug report email to the configured bug report recipient.

        images: list of dicts with keys {filename: str, content_type: str, data_base64: str}
        """
        try:
            if not self.email_user or not self.email_password:
                return {"success": False, "message": "Email credentials not configured"}

            to_addr = getattr(settings, 'bug_report_recipient', None) or 'colin.buchheit@beartechs.com'

            subject = "VoiceToReport - Bug Report"
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')
            reporter_line = f"Reporter: {reporter_email}\n" if reporter_email else ""
            text_body = f"A new bug report was submitted.\n\n{reporter_line}Time: {timestamp}\n\nDescription:\n{description or '(no description)'}\n"

            msg = MIMEMultipart()
            msg['From'] = self.email_user
            msg['To'] = to_addr
            msg['Subject'] = subject
            msg.attach(MIMEText(text_body, 'plain'))

            # Attach images if provided
            for idx, img in enumerate(images or []):
                try:
                    filename = img.get('filename') or f'screenshot-{idx+1}.jpg'
                    content_type = img.get('content_type') or 'image/jpeg'
                    data_b64 = img.get('data_base64') or ''
                    raw = base64.b64decode(data_b64)

                    maintype, subtype = content_type.split('/', 1) if '/' in content_type else ('image', 'jpeg')
                    if maintype == 'image':
                        part = MIMEImage(raw, _subtype=subtype)
                    else:
                        part = MIMEBase(maintype, subtype)
                        part.set_payload(raw)
                        encoders.encode_base64(part)
                    part.add_header('Content-Disposition', 'attachment', filename=filename)
                    msg.attach(part)
                except Exception as e:
                    logger.warning(f"Failed to attach image {idx}: {e}")

            # Send email
            context = ssl.create_default_context(cafile=certifi.where())
            if str(self.smtp_port) == '465':
                with smtplib.SMTP_SSL(self.smtp_server, int(self.smtp_port), timeout=20, context=context) as server:
                    server.ehlo()
                    server.login(self.email_user, self.email_password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(self.smtp_server, int(self.smtp_port), timeout=20) as server:
                    server.ehlo()
                    server.starttls(context=context)
                    server.ehlo()
                    server.login(self.email_user, self.email_password)
                    server.send_message(msg)

            return {"success": True, "message": "Bug report sent"}
        except Exception as e:
            logger.error(f"Failed to send bug report: {e}")
            return {"success": False, "message": f"Failed to send bug report: {str(e)}"}
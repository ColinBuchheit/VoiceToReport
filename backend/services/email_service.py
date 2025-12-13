# backend/services/email_service.py - SLEEK HTML EMAIL FORMAT (Unified)
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
        
        # Parse recipients strictly from environment/config (no hard-coded fallback)
        if settings.email_recipients:
            # Split by comma and clean up whitespace
            self.recipients = [email.strip() for email in settings.email_recipients.split(',') if email.strip()]
        else:
            # No recipients configured; leave empty and let send methods report an error
            self.recipients = []
        
        if self.recipients:
            logger.info(f"Email service initialized with {len(self.recipients)} recipients: {', '.join(self.recipients)}")
        else:
            logger.warning("Email service initialized with 0 recipients. Set EMAIL_RECIPIENTS in environment (comma-separated).")
    
    def _safe_get(self, data: Union[Dict[str, Any], object], key: str, default: str = 'Not specified') -> str:
        """
        Safely get value from either a dictionary or an object with attributes
        """
        try:
            if isinstance(data, dict):
                return data.get(key, default)
            else:
                # Handle Pydantic objects or other objects with attributes
                return getattr(data, key, default)
        except (AttributeError, TypeError):
            return default

    def _get_secret_value(self, maybe_secret: Any) -> str | None:
        """Return the plain string for SecretStr or str; None if empty/None."""
        try:
            # Pydantic v2 SecretStr
            if hasattr(maybe_secret, "get_secret_value"):
                value = maybe_secret.get_secret_value()
            else:
                value = maybe_secret
        except Exception:
            value = None
        if isinstance(value, str) and not value.strip():
            return None
        return value

    def _value_for(self, data: Union[Dict[str, Any], object], key: str, default: str = 'Not specified') -> str:
        """
        Get a field value with sensible fallbacks for known synonyms.
        - work_completed <= taskDescription
        - scope_completed <= outcome
        - notes <= additional_notes
        - work_order <= workOrder/work_order_number
        """
        # Primary
        v = self._safe_get(data, key, None)
        if v and v != 'Not specified':
            return v

        # Fallbacks for specific fields
        if key == 'work_completed':
            v2 = self._safe_get(data, 'taskDescription', None)
            return v2 if v2 else default
        if key == 'scope_completed':
            v2 = self._safe_get(data, 'outcome', None)
            return v2 if v2 else default
        if key == 'notes':
            v2 = self._safe_get(data, 'additional_notes', None)
            return v2 if v2 else default
        if key == 'work_order':
            for alt in ['workOrder', 'work_order_number']:
                v2 = self._safe_get(data, alt, None)
                if v2 and v2 != 'Not specified':
                    return v2
            return default

        return default
    
    def get_recipients(self) -> List[str]:
        """Get current list of email recipients"""
        return self.recipients.copy()

    def _get_logo_base64(self) -> str:
        """Load and encode the local logo as base64 (fallback to placeholder)."""
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

    def format_closeout_email_html(
        self,
        closeout_data: Union[Dict[str, Any], object],
        transcription: str,
        technician_name: str | None = None,
        technician_email: str | None = None,
        logo_src_override: str | None = None,
    ) -> str:
        """Format closeout data into a sleek, professional HTML email."""

        timestamp = datetime.now().strftime("%B %d, %Y")

        # Extract work order with fallbacks
        work_order = None
        for field_name in ['work_order', 'workOrder', 'work_order_number']:
            val = self._safe_get(closeout_data, field_name, None)
            if val and val != 'Not specified':
                work_order = val
                break
        if not work_order or work_order == 'Not specified':
            work_order = 'Not Specified'

        location_name = self._safe_get(closeout_data, 'location', None)
        tech_name = technician_name or self._safe_get(closeout_data, 'technician_name', None)
        if tech_name in (None, '', 'Not specified', 'Not mentioned'):
            tech_name = None

        if technician_email:
            technician_email = technician_email.strip()
        if technician_email in (None, '', 'Not specified', 'Not mentioned'):
            technician_email = None
        logo_src = logo_src_override or self._get_logo_base64()

        # Ensure all fields appear in the structured sections in the required order
        field_groups = [
            {"title": "Job Details", "fields": [
                ("work_order", "Work Order #"),
                ("location", "Location"),
                ("technician_name", "Technician Name"),
            ]},
            {"title": "Service Summary", "fields": [
                ("scope_completed", "Scope Status"),
                ("checked_in_with", "Checked In With"),
                ("check_in_code", "Check In Code"),
                ("onsite_contact", "On-Site Contact"),
                ("support_contact", "Support Contact"),
                ("released_by", "Released By"),
                ("release_code", "Release Code"),
                ("transcription", "Transcription"),  # special-case value from argument
            ]},
            {"title": "Technical Information", "fields": [
                ("work_completed", "Work Completed"),
                ("troubleshooting_steps", "Troubleshooting Steps"),
                ("delays", "Delays & Issues"),
                ("out_of_scope_work", "Out of Scope Work"),
            ]},
            {"title": "Closeout Details", "fields": [
                ("return_tracking", "Return Tracking"),
                ("materials_used", "Materials Used"),
                ("expenses", "Expenses"),
                ("photos_uploaded", "Photos Uploaded"),
            ]},
        ]

        sections_html = ""
        # Values to treat as absent in the overall sections
        HIDE_VALUES = {None, "", "Not specified", "Not mentioned", "None"}
        for group in field_groups:
            group_html = ""
            has_content = False
            for field_name, _ in group["fields"]:
                value = self._value_for(closeout_data, field_name)
                if isinstance(value, str):
                    value_cmp = value.strip()
                else:
                    value_cmp = value
                if value_cmp not in HIDE_VALUES:
                    has_content = True
                    break
            if not has_content:
                continue
            group_html += f"""
            <tr>
                <td style="padding: 28px 0 12px 0;">
                    <h2 class="section-title" style="margin:0; font-size:12px; font-weight:700; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.08em;">{group['title']}</h2>
                </td>
            </tr>
            """
            for field_name, label in group["fields"]:
                # Special-case: transcription value comes from argument, not summary
                if field_name == 'transcription':
                    value = transcription
                else:
                    value = self._value_for(closeout_data, field_name)
                value_cmp = value.strip() if isinstance(value, str) else value
                if value_cmp not in HIDE_VALUES:
                    group_html += f"""
            <tr>
                <td style="padding: 8px 0 12px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="field-card" style="width:100%; background-color:#FFFFFF; border-radius:10px; border:1px solid #ECEFF1; box-shadow:0 2px 8px rgba(12,12,12,0.04);">
                        <tr>
                            <td style=\"padding:14px 16px;\">
                                <div class=\"field-label\" style=\"font-size:12px; font-weight:700; color:#374151; margin-bottom:6px;\">{label}</div>
                                <div class=\"field-value\" style=\"font-size:14px; line-height:1.6; color:#0B0B0B;\">{value}</div>
                            </td>
                            <td width=\"8\" style=\"width:8px;\"></td>
                        </tr>
                    </table>
                </td>
            </tr>
                    """
            sections_html += group_html

        # Transcription is only shown within the Service Summary section
        transcription_html = ""

        # Build a simplified, ordered copy block for easy paste into emails or portals
        copy_lines: list[str] = []
        # Technician line (optional)
        if tech_name or technician_email:
            if tech_name and technician_email:
                copy_lines.append(f"Technician - {tech_name} ({technician_email})")
            elif tech_name:
                copy_lines.append(f"Technician - {tech_name}")
            else:
                copy_lines.append(f"Technician - {technician_email}")

        # Canonical order and labels for copy/paste block (omit Location/WO header badge)
        ordered_fields: list[tuple[str, str]] = [
            ("scope_completed", "Scope Status"),
            ("checked_in_with", "Checked In With"),
            ("check_in_code", "Check In Code"),
            ("onsite_contact", "On-Site Contact"),
            ("support_contact", "Support Contact"),
            ("released_by", "Released By"),
            ("release_code", "Release Code"),
            ("work_completed", "Work Completed"),
            ("troubleshooting_steps", "Troubleshooting Steps"),
            ("delays", "Delays & Issues"),
            ("out_of_scope_work", "Out of Scope Work"),
            ("return_tracking", "Return Tracking"),
            ("materials_used", "Materials Used"),
            ("expenses", "Expenses"),
            ("photos_uploaded", "Photos Uploaded"),
            ("notes", "Notes"),
        ]

        # Use _value_for to benefit from synonyms/fallbacks
        for field_name, label in ordered_fields:
            value = self._value_for(closeout_data, field_name)
            # Skip fields with placeholders or explicit "None"
            if value and value not in ['Not specified', 'Not mentioned', 'None', 'none', 'No', 'no']:
                # Prefer dash formatting for quick paste
                copy_lines.append(f"{label} - {value}")

        # Include transcription at the end of the copy/paste block (single-line for easy paste)
        if isinstance(transcription, str):
            tx = transcription.strip()
            if tx:
                copy_lines.append(f"Transcription - {tx}")

        # Use HTML line breaks for better mobile compatibility; sanitize each line to preserve <br>
        sanitized_lines = [line.replace('<', '\u27e8').replace('>', '\u27e9') for line in copy_lines]
        copy_block_text = ("<br><br>".join(sanitized_lines))
        copy_paste_html = f"""
            <tr>
                <td style=\"padding: 28px 0 12px 0;\">
                    <h2 class=\"section-title\" style=\"margin:0; font-size:12px; font-weight:700; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.08em;\">Copy/Paste Summary</h2>
                </td>
            </tr>
            <tr>
                <td style=\"padding: 8px 0 16px 0;\">
                    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" style=\"background-color:#F7F7F8; border:1px solid #ECEFF1; border-radius:10px;\">
                        <tr>
                            <td style=\"padding:14px 16px;\">
                                <div style=\"font-family:Menlo,Consolas,'Courier New',monospace; font-size:12px; line-height:1.8; color:#374151;\">{copy_block_text}</div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        """

        technician_badge_html = ""
        if tech_name or technician_email:
            tech_label_parts: list[str] = []
            if tech_name:
                tech_label_parts.append(tech_name)
            if technician_email:
                tech_label_parts.append(f"<span style=\"color:#6B7280;\">{technician_email}</span>")
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
        <html lang=\"en\">
        <head>
            <meta charset=\"UTF-8\">
            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
            <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">
            <meta name=\"x-apple-disable-message-reformatting\">
            <meta name=\"color-scheme\" content=\"light dark\">
            <meta name=\"supported-color-schemes\" content=\"light dark\">
            <title>Field Service Closeout Report</title>
            <style>
                :root {{
                    color-scheme: light dark;
                    supported-color-schemes: light dark;
                }}
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
        <body style=\"margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-text-size-adjust: 100%; line-height: 1.5;\">
            <table role=\"presentation\" class=\"email-bg\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" style=\"background-color: #F3F4F6;\">
                <tr>
                    <td align=\"center\" style=\"padding: 40px 20px;\">
                        <table role=\"presentation\" class=\"card-bg\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" style=\"max-width: 600px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);\">
                            <tr>
                                <td class=\"header-bg\" style=\"padding: 28px 28px 22px 28px; background-color: #0B0B0B; border-bottom: 1px solid rgba(255,255,255,0.06);\">
                                    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\">\n
                                        <tr>
                                            <td align=\"center\" style=\"padding-bottom: 20px;\">\n
                                                <img src=\"{logo_src}\" alt=\"Bear Techs\" width=\"150\" style=\"height: auto; display: block; border: 0;\">\n
                                            </td>
                                        </tr>
                                        <tr>
                                            <td align=\"center\">\n
                                                <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" style=\"margin: 0 auto;\">\n
                                                    <tr>
                                                        <td style=\"text-align:center;\">\n
                                                            <div class=\"wo-badge\" style=\"display: inline-block; background-color: #FF6B35; color: #FFFFFF; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight:700; letter-spacing:0.01em;\">\n
                                                                {location_name if location_name and location_name != 'Not specified' else 'Location'} · WO {work_order}\n
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
                            <tr>
                                <td style=\"padding: 14px 28px; background-color: #F7F7F8; border-bottom: 1px solid #ECEFF1;\">\n
                                    <span class=\"timestamp-text\" style=\"font-size:13px; color:#9CA3AF;\">Report Generated: {timestamp}</span>
                                </td>
                            </tr>
                            <tr>
                                <td style=\"padding: 18px 28px 28px 28px;\">\n
                                    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\">\n
                                        {sections_html}
                                        {copy_paste_html}
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td class=\"footer-bg\" style=\"padding: 20px 28px; background-color: #F7F7F8; border-top: 1px solid #ECEFF1; text-align: center;\">\n
                                    <div class=\"footer-text\" style=\"font-size:12px; color:#9CA3AF; line-height:1.5;\">\n
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
    
    def send_closeout_email(self, closeout_data: Union[Dict[str, Any], object], transcription: str, technician_name: str | None = None, technician_email: str | None = None, attachments: List[Any] | None = None) -> Dict[str, Any]:
        """Send the closeout email to the specified recipients using sleek HTML format."""
        
        try:
            # Validate email configuration
            pwd = self._get_secret_value(self.email_password)
            if not self.email_user or not pwd:
                logger.error("Email credentials not configured - check EMAIL_USER and EMAIL_PASSWORD in .env file")
                return {
                    "success": False,
                    "message": "Email credentials not configured",
                    "recipients": []
                }
            
            if not self.recipients:
                logger.error("No email recipients configured")
                return {
                    "success": False,
                    "message": "No recipients configured",
                    "recipients": []
                }
            
            logger.info(f"Sending closeout email to {len(self.recipients)} recipients: {', '.join(self.recipients)}")

            # Build subject line similar to staging/deploy
            timestamp = datetime.now().strftime("%Y-%m-%d")
            work_order = None
            for field_name in ['work_order', 'workOrder', 'work_order_number']:
                val = self._safe_get(closeout_data, field_name, None)
                if val and val != 'Not specified':
                    work_order = val
                    break
            if not work_order or work_order == 'Not specified':
                work_order = 'Not Specified'
            location_name = self._safe_get(closeout_data, 'location', None)
            subject = (f"{location_name} - WO {work_order}" if location_name and location_name != 'Not specified'
                       else f"WO {work_order} - {timestamp}")

            # Create multipart/related message
            msg = MIMEMultipart('related')
            msg['From'] = self.email_user
            recipients = list(self.recipients)
            if technician_email:
                try:
                    te = technician_email.strip()
                    if te and te not in recipients:
                        recipients.append(te)
                except Exception:
                    pass
            msg['To'] = ', '.join(recipients)
            try:
                msg['Date'] = format_datetime(datetime.now())
            except Exception:
                msg['Date'] = datetime.now().strftime('%a, %d %b %Y %H:%M:%S')
            msg['Subject'] = subject
            msg['X-Template-Version'] = 'v2-html-2025-10-11'

            # Generate HTML body (reference inline logo by CID)
            html_body = self.format_closeout_email_html(
                closeout_data,
                transcription,
                technician_name,
                technician_email,
                logo_src_override='cid:bear_logo'
            )

            alternative = MIMEMultipart('alternative')
            alternative.attach(MIMEText(html_body, 'html'))
            msg.attach(alternative)

            # Attach inline logo if available
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
            
            # Attach user-provided files (PDFs, images, documents)
            if attachments:
                for attachment in attachments:
                    try:
                        # Get attachment data from Pydantic model or dict
                        if hasattr(attachment, 'filename'):
                            filename = attachment.filename
                            content_type = attachment.content_type
                            data_base64 = attachment.data_base64
                        else:
                            filename = attachment.get('filename', 'attachment')
                            content_type = attachment.get('content_type', 'application/octet-stream')
                            data_base64 = attachment.get('data_base64', '')
                        
                        if not data_base64:
                            logger.warning(f"⚠️ Skipping attachment '{filename}' - no data")
                            continue
                        
                        # Decode base64 data
                        file_data = base64.b64decode(data_base64)
                        
                        # Create appropriate MIME part based on content type
                        maintype, _, subtype = content_type.partition('/')
                        if maintype == 'image':
                            part = MIMEImage(file_data, _subtype=subtype or 'jpeg')
                        else:
                            part = MIMEBase(maintype or 'application', subtype or 'octet-stream')
                            part.set_payload(file_data)
                            encoders.encode_base64(part)
                        
                        # Add headers for attachment
                        part.add_header('Content-Disposition', 'attachment', filename=filename)
                        msg.attach(part)
                        logger.info(f"📎 Attached file: {filename} ({content_type}, {len(file_data)} bytes)")
                    except Exception as attach_err:
                        logger.warning(f"⚠️ Failed to attach file: {attach_err}")
            
            # Send email
            # Use a verified CA bundle for TLS (fixes local TLS errors)
            ctx = ssl.create_default_context(cafile=certifi.where())
            # Optionally load additional CA if provided (corp VPN/proxy)
            try:
                ca_bundle = getattr(settings, "smtp_ca_bundle", None)
                if ca_bundle:
                    ctx.load_verify_locations(cafile=ca_bundle)
            except Exception as ca_err:
                logger.warning(f"Could not load custom CA bundle: {ca_err}")
            # Dev-only insecure toggle (local testing when corp proxy breaks TLS)
            try:
                if getattr(settings, "smtp_tls_insecure", False):
                    ctx.check_hostname = False
                    ctx.verify_mode = ssl.CERT_NONE
                    logger.warning("SMTP TLS verification DISABLED for local testing (smtp_tls_insecure=true)")
            except Exception:
                pass
            # Support STARTTLS (587) and SMTPS (465)
            if str(self.smtp_port) == '465':
                with smtplib.SMTP_SSL(self.smtp_server, int(self.smtp_port), timeout=30, context=ctx) as server:
                    server.ehlo()
                    server.login(self.email_user, pwd)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(self.smtp_server, int(self.smtp_port), timeout=30) as server:
                    server.ehlo()
                    server.starttls(context=ctx)
                    server.ehlo()
                    server.login(self.email_user, pwd)
                    server.send_message(msg)
            
            logger.info(f"Closeout email sent successfully to {len(recipients)} recipients")
            return {
                "success": True,
                "message": "Email sent successfully",
                "recipients": recipients
            }
            
        except Exception as e:
            logger.error(f"Failed to send closeout email: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to send email: {str(e)}",
                "recipients": []
            }
    
    def test_email_connection(self) -> Dict[str, Any]:
        """Test email configuration and connection"""
        
        try:
            pwd = self._get_secret_value(self.email_password)
            if not self.email_user or not pwd:
                return {
                    "status": "error",
                    "message": "Email credentials not configured - add EMAIL_USER and EMAIL_PASSWORD to .env file"
                }
            
            # Test SMTP connection with verified CA bundle
            ctx = ssl.create_default_context(cafile=certifi.where())
            try:
                ca_bundle = getattr(settings, "smtp_ca_bundle", None)
                if ca_bundle:
                    ctx.load_verify_locations(cafile=ca_bundle)
            except Exception as ca_err:
                logger.warning(f"Could not load custom CA bundle: {ca_err}")
            # Dev-only insecure toggle (local testing when corp proxy breaks TLS)
            try:
                if getattr(settings, "smtp_tls_insecure", False):
                    ctx.check_hostname = False
                    ctx.verify_mode = ssl.CERT_NONE
                    logger.warning("SMTP TLS verification DISABLED for local testing (smtp_tls_insecure=true)")
            except Exception:
                pass
            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=30) as server:
                server.ehlo()
                server.starttls(context=ctx)
                server.ehlo()
                server.login(self.email_user, pwd)
            
            return {
                "status": "success",
                "message": "Email configuration is valid",
                "smtp_server": self.smtp_server,
                "smtp_port": self.smtp_port,
                "recipients": self.recipients,
                "sender": self.email_user
            }
            
        except Exception as e:
            return {
                "status": "error", 
                "message": f"Email connection failed: {str(e)}"
            }

    def send_bug_report(self, description: str, reporter_email: str | None = None, images: list[Dict[str, Any]] | None = None) -> Dict[str, Any]:
        """Send a bug report email to the configured recipient, with optional image attachments."""
        try:
            pwd = self._get_secret_value(self.email_password)
            if not self.email_user or not pwd:
                return {"success": False, "message": "Email credentials not configured", "recipients": []}

            recipient = getattr(settings, "bug_report_recipient", None) or self.email_user
            recipients = [recipient]

            msg = MIMEMultipart()
            msg["From"] = self.email_user
            msg["To"] = ", ".join(recipients)
            msg["Subject"] = "Bug Report from Voice-to-Report App"

            body_lines = [
                "A new bug report was submitted.",
                "",
                f"Reporter: {reporter_email or 'unknown'}",
                "",
                "Description:",
                description or "(no description)",
            ]
            msg.attach(MIMEText("\n".join(body_lines), "plain"))

            # Attach images if provided
            for img in (images or []):
                try:
                    filename = img.get("filename") or "screenshot.png"
                    content_type = img.get("content_type") or "application/octet-stream"
                    data_b64 = img.get("data_base64")
                    if not data_b64:
                        continue
                    raw = base64.b64decode(data_b64)
                    maintype, _, subtype = content_type.partition("/")
                    part = MIMEBase(maintype or "application", subtype or "octet-stream")
                    part.set_payload(raw)
                    encoders.encode_base64(part)
                    part.add_header("Content-Disposition", f"attachment; filename=\"{filename}\"")
                    msg.attach(part)
                except Exception as attach_err:
                    logger.warning(f"Failed to attach image to bug report: {attach_err}")

            ctx = ssl.create_default_context(cafile=certifi.where())
            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=30) as server:
                server.ehlo()
                server.starttls(context=ctx)
                server.ehlo()
                server.login(self.email_user, pwd)
                server.send_message(msg)

            return {"success": True, "message": "Bug report sent", "recipients": recipients}
        except Exception as e:
            logger.error(f"Failed to send bug report: {e}")
            return {"success": False, "message": str(e), "recipients": []}
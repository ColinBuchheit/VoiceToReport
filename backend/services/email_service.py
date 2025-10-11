# backend/services/email_service.py - COMPLETE FILE WITH ALL FIXES
import logging
import smtplib
import ssl
import certifi
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import base64
from typing import List, Dict, Any, Union
from datetime import datetime
from config import settings

logger = logging.getLogger(__name__)

class EmailService:
    """Service for sending closeout report emails"""
    
    def __init__(self):
        self.smtp_server = settings.smtp_server
        self.smtp_port = int(settings.smtp_port)
        self.email_user = settings.email_user
        self.email_password = settings.email_password
        
        # Parse recipients from environment variable with fallback
        if settings.email_recipients:
            # Split by comma and clean up whitespace
            self.recipients = [email.strip() for email in settings.email_recipients.split(',') if email.strip()]
        else:
            # Fallback to default recipient
            self.recipients = ['colbol42@gmail.com']
        
        logger.info(f"Email service initialized with {len(self.recipients)} recipients: {', '.join(self.recipients)}")
    
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
    
    def get_recipients(self) -> List[str]:
        """Get current list of email recipients"""
        return self.recipients.copy()
    
    def format_closeout_email(self, closeout_data: Union[Dict[str, Any], object], transcription: str, technician_name: str = None) -> str:
        """Format the closeout data into a professional email body - FIXED for objects"""
        
        # Generate timestamp
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Use safe_get to handle both dictionaries and objects

        email_body = f"""Field Service Closeout Report
Generated: {timestamp}

CLOSEOUT NOTES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Who did you meet with on-site?
{self._safe_get(closeout_data, 'onsite_contact')}

Who did you work with for support?
{self._safe_get(closeout_data, 'support_contact')}

What work was completed?
{self._safe_get(closeout_data, 'work_completed')}

Were there any delays?
{self._safe_get(closeout_data, 'delays')}

What troubleshooting steps did you take?
{self._safe_get(closeout_data, 'troubleshooting_steps')}

Was the scope completed successfully?
{self._safe_get(closeout_data, 'scope_completed')}

Who released you?
{self._safe_get(closeout_data, 'released_by')}

Is there a release code? If so, what is it?
{self._safe_get(closeout_data, 'release_code')}

Is there a return tracking number? If so, what is it?
{self._safe_get(closeout_data, 'return_tracking')}


EXPENSES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Did you have any expenses (parking fees, etc)?
{self._safe_get(closeout_data, 'expenses')}

What materials did you use?
{self._safe_get(closeout_data, 'materials_used')}


OUT OF SCOPE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Was there any out of scope work? If so, what is it and who approved the work?
{self._safe_get(closeout_data, 'out_of_scope_work')}


PHOTOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

How many photos did you upload?
{self._safe_get(closeout_data, 'photos_uploaded')}


ADDITIONAL INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Work Order #: {self._safe_get(closeout_data, 'work_order')}

Technician: {technician_name or 'Field Technician'}


ORIGINAL TRANSCRIPTION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{transcription}


---
This report was automatically generated from voice input using the Bear Technologies Field Service App.
"""
        return email_body
    
    def send_closeout_email(self, closeout_data: Union[Dict[str, Any], object], transcription: str, technician_name: str | None = None, technician_email: str | None = None) -> Dict[str, Any]:
        """Send the closeout email to the specified recipients - FIXED return type"""
        
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
            
            # Create email message
            msg = MIMEMultipart()
            msg['From'] = self.email_user
            # Optionally include technician_email if provided and not already present
            recipients = list(self.recipients)
            if technician_email:
                try:
                    te = technician_email.strip()
                    if te and te not in recipients:
                        recipients.append(te)
                except Exception:
                    pass
            msg['To'] = ', '.join(recipients)
            
            # Generate subject line using safe_get
            tech_name = technician_name or 'Field Technician'
            work_order = self._safe_get(closeout_data, 'work_order', 'No Work Order')
            timestamp = datetime.now().strftime("%Y-%m-%d")

            msg['Subject'] = f"Field Service Closeout - {tech_name} - WO:{work_order} - {timestamp}"
            
            # Format email body
            email_body = self.format_closeout_email(closeout_data, transcription, technician_name)
            
            # Attach body to email
            msg.attach(MIMEText(email_body, 'plain'))
            
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
            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=30) as server:
                server.ehlo()
                server.starttls(context=ctx)
                server.ehlo()
                server.login(self.email_user, pwd)
                server.send_message(msg)
            
            logger.info(f"Closeout email sent successfully to {len(self.recipients)} recipients")
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
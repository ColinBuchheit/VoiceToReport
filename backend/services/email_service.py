# backend/services/email_service.py - COMPLETE FILE WITH ALL FIXES
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
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
    
    def send_closeout_email(self, closeout_data: Union[Dict[str, Any], object], transcription: str, technician_name: str = None) -> Dict[str, Any]:
        """Send the closeout email to the specified recipients - FIXED return type"""
        
        try:
            # Validate email configuration
            if not self.email_user or not self.email_password:
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
            msg['To'] = ', '.join(self.recipients)
            
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
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.email_user, self.email_password)
                server.send_message(msg)
            
            logger.info(f"Closeout email sent successfully to {len(self.recipients)} recipients")
            return {
                "success": True,
                "message": "Email sent successfully",
                "recipients": self.recipients
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
            if not self.email_user or not self.email_password:
                return {
                    "status": "error",
                    "message": "Email credentials not configured - add EMAIL_USER and EMAIL_PASSWORD to .env file"
                }
            
            # Test SMTP connection
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
            return {
                "status": "error", 
                "message": f"Email connection failed: {str(e)}"
            }
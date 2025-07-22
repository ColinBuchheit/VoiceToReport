# backend/services/email_service.py
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any
from datetime import datetime
import os

logger = logging.getLogger(__name__)

class EmailService:
    """Service for sending closeout report emails"""
    
    def __init__(self):
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.email_user = os.getenv('EMAIL_USER')
        self.email_password = os.getenv('EMAIL_PASSWORD')
        
        # Fixed recipient list as specified
        self.recipients = [
            'colbol42@gmail.com'
        ]
        
    def format_closeout_email(self, closeout_data: Dict[str, Any], transcription: str) -> str:
        """Format the closeout data into a professional email body"""
        
        # Generate timestamp
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        email_body = f"""Field Service Closeout Report
Generated: {timestamp}

CLOSEOUT NOTES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Who did you meet with on-site?
{closeout_data.get('onsite_contact', 'Not specified')}

Who did you work with for support?
{closeout_data.get('support_contact', 'Not specified')}

What work was completed?
{closeout_data.get('work_completed', 'Not specified')}

Were there any delays?
{closeout_data.get('delays', 'Not specified')}

What troubleshooting steps did you take?
{closeout_data.get('troubleshooting_steps', 'Not specified')}

Was the scope completed successfully?
{closeout_data.get('scope_completed', 'Not specified')}

Who released you?
{closeout_data.get('released_by', 'Not specified')}

Is there a release code? If so, what is it?
{closeout_data.get('release_code', 'Not specified')}

Is there a return tracking number? If so, what is it?
{closeout_data.get('return_tracking', 'Not specified')}


EXPENSES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Did you have any expenses (parking fees, etc)?
{closeout_data.get('expenses', 'Not specified')}

What materials did you use?
{closeout_data.get('materials_used', 'Not specified')}


OUT OF SCOPE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Was there any out of scope work? If so, what is it and who approved the work?
{closeout_data.get('out_of_scope_work', 'Not specified')}


PHOTOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

How many photos did you upload?
{closeout_data.get('photos_uploaded', 'Not specified')}


ORIGINAL TRANSCRIPTION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{transcription}


---
This report was automatically generated from voice input using the Bear Technologies Field Service App.
"""
        return email_body
    
    def send_closeout_email(self, closeout_data: Dict[str, Any], transcription: str, technician_name: str = None) -> bool:
        """Send the closeout email to the specified recipients"""
        
        try:
            # Validate email configuration
            if not self.email_user or not self.email_password:
                logger.error("Email credentials not configured")
                return False
            
            # Create email message
            msg = MIMEMultipart()
            msg['From'] = self.email_user
            msg['To'] = ', '.join(self.recipients)
            
            # Generate subject line
            tech_name = technician_name or "Field Technician"
            location = closeout_data.get('location', 'Unknown Location')
            timestamp = datetime.now().strftime("%Y-%m-%d")
            
            msg['Subject'] = f"Field Service Closeout - {tech_name} - {location} - {timestamp}"
            
            # Format email body
            email_body = self.format_closeout_email(closeout_data, transcription)
            
            # Attach body to email
            msg.attach(MIMEText(email_body, 'plain'))
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.email_user, self.email_password)
                server.send_message(msg)
            
            logger.info(f"Closeout email sent successfully to {len(self.recipients)} recipients")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send closeout email: {str(e)}")
            return False
    
    def test_email_connection(self) -> Dict[str, Any]:
        """Test email configuration and connection"""
        
        try:
            if not self.email_user or not self.email_password:
                return {
                    "status": "error",
                    "message": "Email credentials not configured"
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
                "recipients": self.recipients
            }
            
        except Exception as e:
            return {
                "status": "error", 
                "message": f"Email connection failed: {str(e)}"
            }
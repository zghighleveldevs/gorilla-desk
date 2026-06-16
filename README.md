# GHL → Gorilla Desk Sync Server

## Deploy to Railway in 5 minutes (FREE)

### Step 1 — Create Railway account
Go to https://railway.app and sign up with GitHub (free)

### Step 2 — Deploy
1. Click "New Project"
2. Choose "Deploy from GitHub repo" OR "Empty project"
3. If Empty project: click "Add Service" → "GitHub Repo" → upload these files

### Step 3 — Set environment variables (optional, already hardcoded)
In Railway dashboard → your service → Variables:
- GHL_API_KEY = pit-da50c690-6f27-4eb3-add8-8c26fea28807
- GHL_LOCATION_ID = QXAnXqg1dimyOsQinMyX
- GD_API_KEY = 6fbd255faab903d6f0928cbaf42134cdef1fb5f0c8fd83f1056c8009bc990f380b0a05cbe977af64
- GD_COMPANY_ID = GD8EB92A5073

### Step 4 — Get your webhook URL
Railway gives you a URL like: https://yourapp.up.railway.app
Your webhook URL will be: https://yourapp.up.railway.app/webhook/appointment

### Step 5 — Add webhook to GHL
1. GHL → Automations → New Workflow
2. Trigger: "Appointment Booked"
3. Action: Custom Webhook → POST → paste your Railway URL/webhook/appointment
4. Save & Publish

### Step 6 — Test
Visit https://yourapp.up.railway.app/test-ghl to verify GHL
Visit https://yourapp.up.railway.app/test-gorilladesk to verify Gorilla Desk

### That's it! 
Book appointment in GHL → appears in Gorilla Desk within seconds.

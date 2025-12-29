# Deploying Sales Dashboard to Vercel

This guide walks you through deploying both the React app and LLM server to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI** (optional but recommended):
   ```bash
   npm install -g vercel
   ```

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Easiest)

1. **Push your code to GitHub**
   ```bash
   git init  # if not already a git repo
   git add .
   git commit -m "Prepare for Vercel deployment"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click "Import Git Repository"
   - Select your GitHub repository
   - Vercel will auto-detect it's a Create React App

3. **Configure Build Settings**
   - **Framework Preset**: Create React App
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `build` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

4. **Add Environment Variables**
   - In the Vercel dashboard, go to: **Settings → Environment Variables**
   - Add the following:
     ```
     Name: OPENAI_API_KEY
     Value: your-openai-api-key-here
     Environment: Production, Preview, Development
     ```

5. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for the build to complete
   - Your app will be live at `https://your-app.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Login to Vercel**
   ```bash
   vercel login
   ```

2. **Deploy from your project directory**
   ```bash
   cd /Users/vivekkumarbaroliya/sales_dashboard/salesdashbaord
   vercel
   ```

3. **Follow the prompts**
   - Set up and deploy: **Y**
   - Which scope?: Select your account
   - Link to existing project?: **N**
   - What's your project's name?: `sales-dashboard`
   - In which directory is your code located?: `./`

4. **Add Environment Variables**
   ```bash
   vercel env add OPENAI_API_KEY
   ```
   - Paste your OpenAI API key when prompted
   - Select all environments (Production, Preview, Development)

5. **Deploy to Production**
   ```bash
   vercel --prod
   ```

## Architecture After Deployment

### How it Works on Vercel

1. **React App**: Served as a static site from the `/build` directory
2. **LLM API**: Runs as a serverless function at `/api/llm`
3. **Automatic Routing**: 
   - Frontend: `https://your-app.vercel.app/`
   - API: `https://your-app.vercel.app/api/llm`

### Local vs Production

| Feature | Local Development | Vercel Production |
|---------|------------------|-------------------|
| React App Port | 3001 | N/A (serverless) |
| LLM Server Port | 3002 | N/A (serverless) |
| API URL | `/api/llm` (proxied) | `/api/llm` (direct) |
| Server Type | Express.js | Serverless Function |

## Project Structure for Vercel

```
salesdashbaord/
├── api/              # Serverless functions
│   └── llm.js       # LLM API endpoint
├── public/          # Static assets
├── src/             # React source code
├── vercel.json      # Vercel configuration
├── package.json     # Dependencies & scripts
└── server.js        # (Local dev only)
```

## Important Files Created

### 1. `/api/llm.js`
- Serverless function that handles LLM requests
- Replaces `server.js` in production
- Auto-scales based on traffic

### 2. `/vercel.json`
- Configuration for Vercel deployment
- Sets up routing and serverless functions
- Configures memory and timeout limits

## Environment Variables Needed

Add these in the Vercel dashboard:

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | ✅ Yes |

## Post-Deployment

### Testing Your Deployment

1. **Visit your app**: `https://your-app.vercel.app`
2. **Load demo data** or upload CSVs
3. **Test the LLM Assistant**: Click "Ask Analytics AI" button
4. **Ask a question** to verify the API works

### Common Issues & Solutions

#### Issue: LLM Assistant shows "Error talking to AI assistant"
**Solution**: 
- Check that `OPENAI_API_KEY` is set in Vercel environment variables
- Redeploy after adding the key

#### Issue: 404 on /api/llm
**Solution**: 
- Ensure `/api/llm.js` file exists in your repository
- Check that `vercel.json` is properly configured
- Redeploy

#### Issue: CSV files not loading
**Solution**: 
- Ensure CSV files are in the `/public` folder
- They'll be accessible at `https://your-app.vercel.app/filename.csv`

## Updating Your Deployment

### Automatic Updates (Recommended)

If you deployed via GitHub:
1. Push changes to your GitHub repository
2. Vercel automatically rebuilds and deploys

### Manual Updates via CLI

```bash
vercel --prod
```

## Custom Domain (Optional)

1. Go to your project in Vercel dashboard
2. Navigate to **Settings → Domains**
3. Add your custom domain
4. Follow the DNS configuration instructions

## Monitoring & Logs

- **View Logs**: Vercel Dashboard → Your Project → Functions → Logs
- **Analytics**: Vercel Dashboard → Your Project → Analytics
- **Error Tracking**: Logs show runtime errors from the serverless function

## Cost Considerations

### Vercel Free Tier Includes:
- ✅ Unlimited deployments
- ✅ 100 GB bandwidth/month
- ✅ Serverless function executions: 100 GB-hours
- ✅ HTTPS & CDN included

### OpenAI Costs:
- `gpt-4o-mini`: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Typical query: 2-5k tokens = $0.001-0.003 per question

## Rollback to Previous Version

If something breaks:
1. Go to Vercel Dashboard → Your Project → Deployments
2. Find a working deployment
3. Click "..." → Promote to Production

## Local Development vs Production

### Local Development (as before)
```bash
# Terminal 1: React app
npm start

# Terminal 2: LLM server
npm run llm-server
```

### Production
- Everything runs on Vercel
- No need to manage servers
- Auto-scaling based on traffic

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Vercel Discord**: https://vercel.com/discord
- **OpenAI API Docs**: https://platform.openai.com/docs

---

## Quick Commands Reference

```bash
# Deploy to production
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs your-deployment-url

# Add environment variable
vercel env add VARIABLE_NAME

# Pull environment variables locally
vercel env pull
```

Good luck with your deployment! 🚀


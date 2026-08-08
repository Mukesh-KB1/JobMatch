FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Dev-server container for local docker-compose convenience. For a real
# deployment, build a static bundle (`npm run build`) and serve it from
# Vercel/Netlify/any static host instead - see README section 10.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

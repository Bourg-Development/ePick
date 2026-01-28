FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules (bcrypt, argon2)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/bin/www"]

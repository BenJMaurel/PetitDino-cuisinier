# Use a lightweight Node image
FROM node:20-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose port 3000 (Aligned with server.ts and AI Studio preview)
EXPOSE 3000

# Start the development server
# The --host flag ensures Vite/Express is accessible outside the container
CMD ["npm", "run", "dev", "--", "--host"]

# Use a imagem oficial do Node.js como base
FROM node:18-alpine

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia os arquivos package.json e package-lock.json para instalar as dependências
COPY package*.json ./

# Instala as dependências do projeto
RUN npm install --production

# Copia o restante do código da aplicação para o contêiner
COPY . .

# Expõe a porta que a aplicação irá escutar
EXPOSE 8080

# Comando para iniciar a aplicação
CMD ["node", "server.js"]

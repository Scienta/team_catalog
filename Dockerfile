FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM eclipse-temurin:21-jdk AS backend
WORKDIR /app
COPY backend/gradle gradle
COPY backend/gradlew backend/build.gradle.kts backend/settings.gradle.kts backend/gradle.properties ./
RUN ./gradlew dependencies --no-daemon || true
COPY backend/src src
RUN ./gradlew buildFatJar --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=backend /app/build/libs/scienta-backend.jar app.jar
COPY --from=frontend /app/dist static/
CMD ["java", "-jar", "app.jar"]

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY build/libs/scienta-backend.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

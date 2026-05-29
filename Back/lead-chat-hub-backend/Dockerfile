FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY LeadChatHub.sln .
COPY LeadChatHub.Core/*.csproj LeadChatHub.Core/
COPY LeadChatHub.Infrastructure/*.csproj LeadChatHub.Infrastructure/
COPY LeadChatHub.Application/*.csproj LeadChatHub.Application/
COPY LeadChatHub.API/*.csproj LeadChatHub.API/
RUN dotnet restore

ARG CACHEBUST=11
COPY . .
RUN dotnet publish LeadChatHub.API/LeadChatHub.API.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production
ENV PORT=5000
EXPOSE 5000

ENTRYPOINT ["dotnet", "LeadChatHub.API.dll"]

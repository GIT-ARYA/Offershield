
package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func main() {
	router := gin.Default()

	// Allow requests from our local Next.js frontend.
	router.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		if origin == "http://localhost:3000" {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	// Basic health check.
	router.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"service":   "offershield-api",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	// Temporary API information endpoint.
	router.GET("/api/v1", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"name":    "OfferShield API",
			"version": "0.1.0",
			"message": "Welcome to OfferShield",
		})
	})

	if err := router.Run(":8080"); err != nil {
		panic(err)
	}
}

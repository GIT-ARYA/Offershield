
package main

import (
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type ScanRequest struct {
	Content string `json:"content" binding:"required"`
	Type    string `json:"type" binding:"required"`
}

type Finding struct {
	Type        string `json:"type"`
	Severity    string `json:"severity"`
	Evidence    string `json:"evidence"`
	Explanation string `json:"explanation"`
}

type ScanResponse struct {
	ScanID          string   `json:"scan_id"`
	RiskLevel       string   `json:"risk_level"`
	Findings        []Finding `json:"findings"`
	Recommendations []string `json:"recommendations"`
	Message         string   `json:"message"`
}

var (
	shortURLPattern = regexp.MustCompile(
		`(?i)\b(bit\.ly|tinyurl\.com|t\.co|rb\.gy|is\.gd)/\S+`,
	)

	salaryPattern = regexp.MustCompile(
		`(?i)(₹|rs\.?|inr)\s?\d[\d,]*(\s?(lpa|lakhs?|crore|cr))?`,
	)
)

func main() {
	router := gin.Default()

	// Allow requests from the local Next.js frontend.
	router.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		if origin == "http://localhost:3000" {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header(
				"Access-Control-Allow-Methods",
				"GET, POST, OPTIONS",
			)
			c.Header(
				"Access-Control-Allow-Headers",
				"Content-Type, Authorization",
			)
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "OfferShield backend is running",
		})
	})

	router.GET("/api/v1", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"name":    "OfferShield API",
			"version": "v1",
		})
	})

	router.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
		})
	})

	// The scan endpoint that was missing.
	router.POST("/api/v1/scans", handleScan)

	// Use a single Go server on port 8080.
	if err := router.Run(":8080"); err != nil {
		panic(err)
	}
}

func handleScan(c *gin.Context) {
	var request ScanRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Please provide valid JSON with content and type fields.",
		})
		return
	}

	content := strings.TrimSpace(request.Content)
	scanType := strings.TrimSpace(request.Type)

	if content == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Content cannot be empty.",
		})
		return
	}

	if len(content) > 20000 {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"error": "Content must not exceed 20,000 bytes.",
		})
		return
	}

	switch scanType {
	case "job_offer", "email", "offer_letter":
		// Supported scan type.
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Unsupported type. Use job_offer, email, or offer_letter.",
		})
		return
	}

	findings := analyseContent(content)

	riskLevel := "low"
	if len(findings) >= 3 {
		riskLevel = "high"
	} else if len(findings) >= 1 {
		riskLevel = "medium"
	}

	recommendations := []string{
		"Verify the employer through its official website and contact details.",
		"Do not send money or sensitive personal information before verification.",
	}

	if len(findings) == 0 {
		recommendations = []string{
			"No indicators were detected by the current basic rules.",
			"Still verify the employer and offer independently.",
		}
	}

	response := ScanResponse{
		ScanID:          "scan-" + time.Now().UTC().Format("20060102T150405.000000000"),
		RiskLevel:       riskLevel,
		Findings:        findings,
		Recommendations: recommendations,
		Message:         "This is a preliminary rule-based assessment, not a definitive scam determination.",
	}

	c.JSON(http.StatusOK, response)
}

func analyseContent(content string) []Finding {
	lowerContent := strings.ToLower(content)
	findings := make([]Finding, 0)

	// Check for requests for upfront payments.
	paymentPhrases := []string{
		"registration fee",
		"pay a fee",
		"pay us",
		"upfront payment",
		"processing fee",
		"security deposit",
		"training fee",
		"deposit money",
	}

	for _, phrase := range paymentPhrases {
		if strings.Contains(lowerContent, phrase) {
			findings = append(findings, Finding{
				Type:        "upfront_payment",
				Severity:    "high",
				Evidence:    phrase,
				Explanation: "The message appears to request an upfront payment. Verify the employer independently before paying.",
			})
			break
		}
	}

	// Check for urgency or pressure tactics.
	urgencyPhrases := []string{
		"act now",
		"immediately",
		"limited time",
		"within 24 hours",
		"urgent",
		"offer expires",
		"don't miss this opportunity",
	}

	for _, phrase := range urgencyPhrases {
		if strings.Contains(lowerContent, phrase) {
			findings = append(findings, Finding{
				Type:        "urgency_pressure",
				Severity:    "medium",
				Evidence:    phrase,
				Explanation: "The message uses urgency or pressure language that may discourage careful verification.",
			})
			break
		}
	}

	// Check for commonly shortened URLs.
	if match := shortURLPattern.FindString(content); match != "" {
		findings = append(findings, Finding{
			Type:        "shortened_url",
			Severity:    "medium",
			Evidence:    match,
			Explanation: "A shortened URL can hide its destination. Inspect the destination carefully before opening it.",
		})
	}

	// Check for unusually strong job or salary promises.
	if salaryPattern.MatchString(content) {
		jobClaimPhrases := []string{
			"no experience",
			"no interview",
			"guaranteed job",
		}

		for _, phrase := range jobClaimPhrases {
			if strings.Contains(lowerContent, phrase) {
				findings = append(findings, Finding{
					Type:        "salary_or_job_claim",
					Severity:    "medium",
					Evidence:    phrase,
					Explanation: "A salary claim combined with an unusually strong job promise deserves independent verification.",
				})
				break
			}
		}
	}

	return findings
}

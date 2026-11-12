export const openapiSpec = {
  "openapi": "3.1.0",
  "info": {
    "title": "FUO Exam Practice Backend API",
    "version": "1.0.0",
    "description": "Backend RESTful API for academic exam practice, mock tests, automated scoring, question bank exploration, and learner statistics."
  },
  "servers": [
    {
      "url": "http://localhost:8787",
      "description": "Local Cloudflare Workers development server (wrangler dev)"
    },
    {
      "url": "https://fuo-learning-backend.workers.dev",
      "description": "Cloudflare Workers production edge environment"
    }
  ],
  "paths": {
    "/health": {
      "get": {
        "summary": "Health check endpoint",
        "responses": {
          "200": {
            "description": "Service is healthy",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HealthResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/v1/auth/register": {
      "post": {
        "summary": "Register a new user account",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RegisterRequest"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Account created successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AuthResponse"
                }
              }
            }
          },
          "400": {
            "description": "Email already registered or invalid input"
          }
        }
      }
    },
    "/api/v1/auth/login": {
      "post": {
        "summary": "Authenticate user and obtain access token",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LoginRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Authentication successful",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AuthResponse"
                }
              }
            }
          },
          "401": {
            "description": "Invalid email or password"
          }
        }
      }
    },
    "/api/v1/auth/me": {
      "get": {
        "summary": "Get currently authenticated user profile",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "User profile details",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UserProfileResponse"
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized"
          }
        }
      }
    },
    "/api/v1/subjects": {
      "get": {
        "summary": "List all active subjects",
        "parameters": [
          {
            "name": "skip",
            "in": "query",
            "schema": {
              "type": "integer",
              "default": 0
            }
          },
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer",
              "default": 50
            }
          }
        ],
        "responses": {
          "200": {
            "description": "List of subjects",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/SubjectSummary"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/v1/subjects/{code}": {
      "get": {
        "summary": "Get subject details by code",
        "parameters": [
          {
            "name": "code",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "example": "MAD101"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Subject details",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/SubjectDetail"
                }
              }
            }
          },
          "404": {
            "description": "Subject not found"
          }
        }
      }
    },
    "/api/v1/subjects/{code}/exams": {
      "get": {
        "summary": "List all exams under a subject",
        "parameters": [
          {
            "name": "code",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "example": "MAD101"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "List of exams categorized under subject",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/ExamSummary"
                  }
                }
              }
            }
          },
          "404": {
            "description": "Subject not found"
          }
        }
      }
    },
    "/api/v1/exams/{exam_id}": {
      "get": {
        "summary": "Get exam metadata and instructions",
        "parameters": [
          {
            "name": "exam_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Detailed exam information",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ExamDetail"
                }
              }
            }
          },
          "404": {
            "description": "Exam not found"
          }
        }
      }
    },
    "/api/v1/exams/{exam_id}/attempts": {
      "post": {
        "summary": "Start a new exam attempt",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "exam_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "201": {
            "description": "Exam attempt started",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AttemptSessionResponse"
                }
              }
            }
          },
          "400": {
            "description": "User already has an ongoing active attempt on this exam"
          },
          "404": {
            "description": "Exam not found"
          }
        }
      }
    },
    "/api/v1/attempts/{attempt_id}": {
      "get": {
        "summary": "Get ongoing attempt status and questions (without answers)",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "attempt_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Attempt state and question set",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AttemptSessionResponse"
                }
              }
            }
          },
          "403": {
            "description": "Forbidden (not the attempt owner)"
          },
          "404": {
            "description": "Attempt not found"
          }
        }
      }
    },
    "/api/v1/attempts/{attempt_id}/answers": {
      "put": {
        "summary": "Record or update an answer for a question in an active attempt",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "attempt_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SubmitAnswerRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Answer recorded successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AnswerSavedResponse"
                }
              }
            }
          },
          "400": {
            "description": "Attempt has expired or already submitted"
          },
          "403": {
            "description": "Forbidden"
          }
        }
      }
    },
    "/api/v1/attempts/{attempt_id}/submit": {
      "post": {
        "summary": "Finalize and submit attempt for automatic scoring",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "attempt_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Attempt submitted and graded",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AttemptResultResponse"
                }
              }
            }
          },
          "400": {
            "description": "Attempt already submitted"
          }
        }
      }
    },
    "/api/v1/attempts/{attempt_id}/review": {
      "get": {
        "summary": "Review completed attempt with correct answers and explanations",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "attempt_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Question-by-question review with explanations",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AttemptReviewResponse"
                }
              }
            }
          },
          "400": {
            "description": "Attempt is still in progress; review not permitted"
          },
          "403": {
            "description": "Forbidden"
          }
        }
      }
    },
    "/api/v1/questions/drills": {
      "get": {
        "summary": "Get topical practice questions from question bank",
        "parameters": [
          {
            "name": "subject_code",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "count",
            "in": "query",
            "schema": {
              "type": "integer",
              "default": 10
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Set of practice questions",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/PracticeQuestion"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/v1/questions/{question_id}/check": {
      "post": {
        "summary": "Check answer for an ephemeral topical drill question",
        "parameters": [
          {
            "name": "question_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/DrillCheckRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Instant correctness and explanation response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/DrillCheckResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/v1/users/me/stats": {
      "get": {
        "summary": "Retrieve authenticated user performance statistics",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Aggregated user statistics",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UserStatisticsResponse"
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized"
          }
        }
      }
    },
    "/api/v1/users/me/attempts": {
      "get": {
        "summary": "Retrieve chronological history of user's past attempts",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "subject_code",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "skip",
            "in": "query",
            "schema": {
              "type": "integer",
              "default": 0
            }
          },
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer",
              "default": 20
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Paginated attempt history",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/AttemptHistoryItem"
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "BearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    },
    "schemas": {
      "HealthResponse": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "example": "healthy"
          },
          "timestamp": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "RegisterRequest": {
        "type": "object",
        "required": [
          "email",
          "password",
          "full_name"
        ],
        "properties": {
          "email": {
            "type": "string",
            "format": "email"
          },
          "password": {
            "type": "string",
            "minLength": 8
          },
          "full_name": {
            "type": "string"
          }
        }
      },
      "LoginRequest": {
        "type": "object",
        "required": [
          "email",
          "password"
        ],
        "properties": {
          "email": {
            "type": "string",
            "format": "email"
          },
          "password": {
            "type": "string"
          }
        }
      },
      "AuthResponse": {
        "type": "object",
        "properties": {
          "access_token": {
            "type": "string"
          },
          "token_type": {
            "type": "string",
            "example": "bearer"
          },
          "user": {
            "$ref": "#/components/schemas/UserProfileResponse"
          }
        }
      },
      "UserProfileResponse": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "email": {
            "type": "string"
          },
          "full_name": {
            "type": "string"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "SubjectSummary": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "code": {
            "type": "string",
            "example": "MAD101"
          },
          "title": {
            "type": "string",
            "example": "Discrete Mathematics"
          },
          "description": {
            "type": "string"
          },
          "total_exams": {
            "type": "integer",
            "example": 5
          }
        }
      },
      "SubjectDetail": {
        "allOf": [
          {
            "$ref": "#/components/schemas/SubjectSummary"
          },
          {
            "type": "object",
            "properties": {
              "icon_url": {
                "type": "string",
                "nullable": true
              }
            }
          }
        ]
      },
      "ExamSummary": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "subject_code": {
            "type": "string"
          },
          "code": {
            "type": "string",
            "example": "MAD101 - FA25 - FEB5"
          },
          "title": {
            "type": "string"
          },
          "duration_minutes": {
            "type": "integer",
            "example": 60
          },
          "total_questions": {
            "type": "integer",
            "example": 50
          },
          "passing_score_percentage": {
            "type": "number",
            "example": 70
          }
        }
      },
      "ExamDetail": {
        "allOf": [
          {
            "$ref": "#/components/schemas/ExamSummary"
          },
          {
            "type": "object",
            "properties": {
              "description": {
                "type": "string"
              }
            }
          }
        ]
      },
      "AttemptQuestion": {
        "type": "object",
        "properties": {
          "question_id": {
            "type": "string"
          },
          "question_number": {
            "type": "integer"
          },
          "question_id_code": {
            "type": "string",
            "example": "Q1"
          },
          "question_type": {
            "type": "string",
            "enum": [
              "single_choice",
              "multiple_choice"
            ]
          },
          "question_text": {
            "type": "string"
          },
          "image_url": {
            "type": "string",
            "nullable": true,
            "example": "/static/exams/MAD101/MAD101%20-%20FA25%20-%20FEB5/Q1.webp"
          },
          "options": {
            "type": "object",
            "additionalProperties": {
              "type": "string"
            },
            "example": {
              "A": "Option text A",
              "B": "Option text B",
              "C": "Option text C",
              "D": "Option text D"
            }
          },
          "selected_options": {
            "type": "string",
            "nullable": true,
            "example": "C"
          }
        }
      },
      "AttemptSessionResponse": {
        "type": "object",
        "properties": {
          "attempt_id": {
            "type": "string"
          },
          "exam_id": {
            "type": "string"
          },
          "exam_title": {
            "type": "string"
          },
          "status": {
            "type": "string",
            "example": "in_progress"
          },
          "started_at": {
            "type": "string",
            "format": "date-time"
          },
          "expires_at": {
            "type": "string",
            "format": "date-time"
          },
          "time_remaining_seconds": {
            "type": "integer"
          },
          "questions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/AttemptQuestion"
            }
          }
        }
      },
      "SubmitAnswerRequest": {
        "type": "object",
        "required": [
          "question_id",
          "selected_options"
        ],
        "properties": {
          "question_id": {
            "type": "string"
          },
          "selected_options": {
            "type": "string",
            "example": "ACD"
          }
        }
      },
      "AnswerSavedResponse": {
        "type": "object",
        "properties": {
          "question_id": {
            "type": "string"
          },
          "selected_options": {
            "type": "string"
          },
          "saved_at": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "AttemptResultResponse": {
        "type": "object",
        "properties": {
          "attempt_id": {
            "type": "string"
          },
          "status": {
            "type": "string",
            "example": "completed"
          },
          "total_questions": {
            "type": "integer",
            "example": 50
          },
          "correct_answers_count": {
            "type": "integer",
            "example": 42
          },
          "total_score": {
            "type": "number",
            "example": 8.4
          },
          "percentage_score": {
            "type": "number",
            "example": 84
          },
          "is_passed": {
            "type": "boolean",
            "example": true
          },
          "submitted_at": {
            "type": "string",
            "format": "date-time"
          },
          "duration_seconds": {
            "type": "integer",
            "example": 2450
          }
        }
      },
      "ReviewQuestionItem": {
        "allOf": [
          {
            "$ref": "#/components/schemas/AttemptQuestion"
          },
          {
            "type": "object",
            "properties": {
              "correct_answer": {
                "type": "string",
                "example": "C"
              },
              "is_correct": {
                "type": "boolean",
                "example": true
              },
              "ai_explanation": {
                "type": "string"
              },
              "option_by_option_analysis": {
                "type": "object",
                "additionalProperties": {
                  "type": "string"
                }
              }
            }
          }
        ]
      },
      "AttemptReviewResponse": {
        "type": "object",
        "properties": {
          "attempt_id": {
            "type": "string"
          },
          "exam_title": {
            "type": "string"
          },
          "percentage_score": {
            "type": "number"
          },
          "is_passed": {
            "type": "boolean"
          },
          "submitted_at": {
            "type": "string",
            "format": "date-time"
          },
          "questions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ReviewQuestionItem"
            }
          }
        }
      },
      "PracticeQuestion": {
        "type": "object",
        "properties": {
          "question_id": {
            "type": "string"
          },
          "subject_code": {
            "type": "string"
          },
          "question_type": {
            "type": "string"
          },
          "question_text": {
            "type": "string"
          },
          "image_url": {
            "type": "string",
            "nullable": true
          },
          "options": {
            "type": "object",
            "additionalProperties": {
              "type": "string"
            }
          }
        }
      },
      "DrillCheckRequest": {
        "type": "object",
        "required": [
          "selected_options"
        ],
        "properties": {
          "selected_options": {
            "type": "string",
            "example": "C"
          }
        }
      },
      "DrillCheckResponse": {
        "type": "object",
        "properties": {
          "question_id": {
            "type": "string"
          },
          "selected_options": {
            "type": "string"
          },
          "correct_answer": {
            "type": "string"
          },
          "is_correct": {
            "type": "boolean"
          },
          "ai_explanation": {
            "type": "string"
          },
          "option_by_option_analysis": {
            "type": "object",
            "additionalProperties": {
              "type": "string"
            }
          }
        }
      },
      "SubjectStatsItem": {
        "type": "object",
        "properties": {
          "subject_code": {
            "type": "string"
          },
          "subject_title": {
            "type": "string"
          },
          "attempts_count": {
            "type": "integer"
          },
          "average_score": {
            "type": "number"
          },
          "highest_score": {
            "type": "number"
          },
          "passed_exams_count": {
            "type": "integer"
          },
          "total_exams_in_subject": {
            "type": "integer"
          }
        }
      },
      "UserStatisticsResponse": {
        "type": "object",
        "properties": {
          "total_attempts_count": {
            "type": "integer",
            "example": 12
          },
          "total_exams_passed": {
            "type": "integer",
            "example": 4
          },
          "overall_pass_rate": {
            "type": "number",
            "example": 0.8
          },
          "overall_average_score": {
            "type": "number",
            "example": 81.5
          },
          "total_practice_duration_minutes": {
            "type": "integer",
            "example": 320
          },
          "subject_breakdowns": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/SubjectStatsItem"
            }
          }
        }
      },
      "AttemptHistoryItem": {
        "type": "object",
        "properties": {
          "attempt_id": {
            "type": "string"
          },
          "exam_id": {
            "type": "string"
          },
          "exam_code": {
            "type": "string"
          },
          "exam_title": {
            "type": "string"
          },
          "subject_code": {
            "type": "string"
          },
          "started_at": {
            "type": "string",
            "format": "date-time"
          },
          "submitted_at": {
            "type": "string",
            "format": "date-time"
          },
          "status": {
            "type": "string"
          },
          "percentage_score": {
            "type": "number"
          },
          "is_passed": {
            "type": "boolean"
          },
          "duration_seconds": {
            "type": "integer"
          }
        }
      }
    }
  }
} as const;

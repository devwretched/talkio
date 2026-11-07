package middleware

import (
	"os"
	"testing"
)

func TestInitJWT_NoSecret(t *testing.T) {
	os.Unsetenv("JWT_SECRET")
	err := InitJWT()
	if err == nil {
		t.Error("expected error when JWT_SECRET is not set, got nil")
	}
}

func TestInitJWT_WithSecret(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret")
	err := InitJWT()
	if err != nil {
		t.Errorf("expected no error, got: %v", err)
	}

	secret := JWTSecret()
	if string(secret) != "test-secret" {
		t.Errorf("expected secret 'test-secret', got: '%s'", string(secret))
	}
}

func TestNormalizeToken(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"Empty string", "", ""},
		{"Valid Token", "abc.def.ghi", "abc.def.ghi"},
		{"Bearer Prefix", "Bearer abc.def.ghi", "abc.def.ghi"},
		{"With Spaces", "  Bearer abc.def.ghi  ", "abc.def.ghi"},
		{"With Quotes", `"abc.def.ghi"`, "abc.def.ghi"},
		{"URL Encoded", "abc%2Bdef.ghi", "abc+def.ghi"},
		{"Space converted back to plus", "abc def.ghi", "abc+def.ghi"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeToken(tt.input)
			if result != tt.expected {
				t.Errorf("expected '%s', got '%s'", tt.expected, result)
			}
		})
	}
}

import { describe, it, expect, beforeEach } from "vitest"

// Mock the Clarity contract environment
const mockTxSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
const mockAdmin = mockTxSender
const mockOtherUser = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"

// Mock contract state
let businesses = {}
let admin = mockAdmin

// Mock contract functions
const businessVerification = {
  "var-get": (varName) => {
    if (varName === "admin") return admin
    throw new Error(`Unknown variable: ${varName}`)
  },
  "var-set": (varName, value) => {
    if (varName === "admin") {
      admin = value
      return { type: "ok", value: true }
    }
    throw new Error(`Unknown variable: ${varName}`)
  },
  "map-get?": ({ "business-id": businessId }) => {
    return businesses[businessId] || null
  },
  "map-set": ({ "business-id": businessId }, value) => {
    businesses[businessId] = value
    return true
  },
  "is-eq": (a, b) => a === b,
  "is-some": (value) => value !== null,
  "is-none": (value) => value === null,
  "unwrap-panic": (value) => value,
  merge: (obj1, obj2) => ({ ...obj1, ...obj2 }),
  "block-height": 123,
}

// Mock tx-sender for different tests
let txSender = mockTxSender

describe("Business Verification Contract", () => {
  beforeEach(() => {
    // Reset state before each test
    businesses = {}
    admin = mockAdmin
    txSender = mockAdmin
  })
  
  describe("register-business", () => {
    it("should register a new business successfully", () => {
      const businessId = "business-123"
      const name = "Test Business"
      const registrationNumber = "REG123"
      
      const result = registerBusiness(businessId, name, registrationNumber)
      
      expect(result.type).toBe("ok")
      expect(businesses[businessId]).toBeDefined()
      expect(businesses[businessId].name).toBe(name)
      expect(businesses[businessId].status).toBe(0) // Unverified
    })
    
    it("should fail if business already exists", () => {
      const businessId = "business-123"
      const name = "Test Business"
      const registrationNumber = "REG123"
      
      // Register once
      registerBusiness(businessId, name, registrationNumber)
      
      // Try to register again
      const result = registerBusiness(businessId, name, registrationNumber)
      
      expect(result.type).toBe("err")
      expect(result.value).toBe(1) // Error 1: Business already exists
    })
  })
  
  describe("verify-business", () => {
    it("should verify a business successfully", () => {
      const businessId = "business-123"
      const name = "Test Business"
      const registrationNumber = "REG123"
      
      // Register first
      registerBusiness(businessId, name, registrationNumber)
      
      // Verify
      const result = verifyBusiness(businessId)
      
      expect(result.type).toBe("ok")
      expect(businesses[businessId].status).toBe(1) // Verified
      expect(businesses[businessId].verification - date).toBe(123) // Block height
    })
    
    it("should fail if not admin", () => {
      const businessId = "business-123"
      txSender = mockOtherUser // Set sender to non-admin
      
      const result = verifyBusiness(businessId)
      
      expect(result.type).toBe("err")
      expect(result.value).toBe(2) // Error 2: Not admin
    })
    
    it("should fail if business not found", () => {
      const businessId = "nonexistent-business"
      
      const result = verifyBusiness(businessId)
      
      expect(result.type).toBe("err")
      expect(result.value).toBe(3) // Error 3: Business not found
    })
  })
  
  describe("is-business-verified", () => {
    it("should return true for verified business", () => {
      const businessId = "business-123"
      const name = "Test Business"
      const registrationNumber = "REG123"
      
      // Register and verify
      registerBusiness(businessId, name, registrationNumber)
      verifyBusiness(businessId)
      
      const result = isBusinessVerified(businessId)
      
      expect(result).toBe(true)
    })
    
    it("should return false for unverified business", () => {
      const businessId = "business-123"
      const name = "Test Business"
      const registrationNumber = "REG123"
      
      // Register but don't verify
      registerBusiness(businessId, name, registrationNumber)
      
      const result = isBusinessVerified(businessId)
      
      expect(result).toBe(false)
    })
    
    it("should return false for nonexistent business", () => {
      const businessId = "nonexistent-business"
      
      const result = isBusinessVerified(businessId)
      
      expect(result).toBe(false)
    })
  })
  
  describe("transfer-admin", () => {
    it("should transfer admin rights successfully", () => {
      const newAdmin = mockOtherUser
      
      const result = transferAdmin(newAdmin)
      
      expect(result.type).toBe("ok")
      expect(admin).toBe(newAdmin)
    })
    
    it("should fail if not current admin", () => {
      const newAdmin = "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
      txSender = mockOtherUser // Set sender to non-admin
      
      const result = transferAdmin(newAdmin)
      
      expect(result.type).toBe("err")
      expect(result.value).toBe(2) // Error 2: Not admin
    })
  })
  
  // Helper functions to simulate contract calls
  function registerBusiness(businessId, name, registrationNumber) {
    if (!businessVerification["is-none"](businessVerification["map-get?"]({ "business-id": businessId }))) {
      return { type: "err", value: 1 } // Business already exists
    }
    
    businessVerification["map-set"](
        { "business-id": businessId },
        {
          owner: txSender,
          name: name,
          "registration-number": registrationNumber,
          status: 0,
          "verification-date": 0,
        },
    )
    
    return { type: "ok", value: true }
  }
  
  function verifyBusiness(businessId) {
    if (txSender !== businessVerification["var-get"]("admin")) {
      return { type: "err", value: 2 } // Not admin
    }
    
    const existingBusiness = businessVerification["map-get?"]({ "business-id": businessId })
    if (!businessVerification["is-some"](existingBusiness)) {
      return { type: "err", value: 3 } // Business not found
    }
    
    businessVerification["map-set"](
        { "business-id": businessId },
        businessVerification["merge"](existingBusiness, {
          status: 1,
          "verification-date": businessVerification["block-height"],
        }),
    )
    
    return { type: "ok", value: true }
  }
  
  function isBusinessVerified(businessId) {
    const business = businessVerification["map-get?"]({ "business-id": businessId })
    return businessVerification["is-some"](business) && business.status === 1
  }
  
  function transferAdmin(newAdmin) {
    if (txSender !== businessVerification["var-get"]("admin")) {
      return { type: "err", value: 2 } // Not admin
    }
    
    businessVerification["var-set"]("admin", newAdmin)
    return { type: "ok", value: true }
  }
})


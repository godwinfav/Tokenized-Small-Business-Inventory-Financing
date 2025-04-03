;; Business Verification Contract
;; Validates legitimate small enterprises

(define-data-var admin principal tx-sender)

;; Business status: 0 = unverified, 1 = verified, 2 = rejected
(define-map businesses
  { business-id: (string-utf8 36) }
  {
    owner: principal,
    name: (string-utf8 100),
    registration-number: (string-utf8 50),
    status: uint,
    verification-date: uint
  }
)

;; Register a new business
(define-public (register-business
    (business-id (string-utf8 36))
    (name (string-utf8 100))
    (registration-number (string-utf8 50)))
  (let ((existing-business (map-get? businesses { business-id: business-id })))
    (asserts! (is-none existing-business) (err u1)) ;; Error 1: Business already exists
    (ok (map-set businesses
      { business-id: business-id }
      {
        owner: tx-sender,
        name: name,
        registration-number: registration-number,
        status: u0, ;; Initially unverified
        verification-date: u0
      }
    ))
  )
)

;; Verify a business (admin only)
(define-public (verify-business (business-id (string-utf8 36)))
  (let ((existing-business (map-get? businesses { business-id: business-id })))
    (asserts! (is-eq tx-sender (var-get admin)) (err u2)) ;; Error 2: Not admin
    (asserts! (is-some existing-business) (err u3)) ;; Error 3: Business not found
    (ok (map-set businesses
      { business-id: business-id }
      (merge (unwrap-panic existing-business)
        {
          status: u1, ;; Set to verified
          verification-date: block-height
        }
      )
    ))
  )
)

;; Reject a business (admin only)
(define-public (reject-business (business-id (string-utf8 36)))
  (let ((existing-business (map-get? businesses { business-id: business-id })))
    (asserts! (is-eq tx-sender (var-get admin)) (err u2)) ;; Error 2: Not admin
    (asserts! (is-some existing-business) (err u3)) ;; Error 3: Business not found
    (ok (map-set businesses
      { business-id: business-id }
      (merge (unwrap-panic existing-business)
        {
          status: u2, ;; Set to rejected
          verification-date: block-height
        }
      )
    ))
  )
)

;; Check if a business is verified
(define-read-only (is-business-verified (business-id (string-utf8 36)))
  (let ((business (map-get? businesses { business-id: business-id })))
    (if (and (is-some business) (is-eq (get status (unwrap-panic business)) u1))
      true
      false
    )
  )
)

;; Get business details
(define-read-only (get-business-details (business-id (string-utf8 36)))
  (map-get? businesses { business-id: business-id })
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u2)) ;; Error 2: Not admin
    (var-set admin new-admin)
    (ok true)
  )
)


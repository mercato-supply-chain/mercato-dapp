'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEscrowIntegration } from '@/lib/hooks/useEscrowIntegration'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Package, 
  DollarSign, 
  Calendar, 
  Building2,
  CheckCircle2,
  ArrowRight,
  Info
} from 'lucide-react'

type FormStep = 1 | 2 | 3

export default function CreateDealPage() {
  const router = useRouter()
  const supabase = createClient()
  const { initializeEscrow, isInitializing } = useEscrowIntegration()
  const [currentStep, setCurrentStep] = useState<FormStep>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [filteredSuppliers, setFilteredSuppliers] = useState<any[]>([])
  const [formData, setFormData] = useState({
    // Step 1: Deal Basics
    productName: '',
    description: '',
    category: '',
    quantity: '',
    pricePerUnit: '',
    
    // Step 2: Supplier & Terms
    supplierId: '',
    supplierName: '',
    supplierContact: '',
    term: '60',
    
    // Step 3: Milestones
    milestone1Name: 'Shipment Confirmation',
    milestone1Percentage: '50',
    milestone2Name: 'Delivery Confirmation',
    milestone2Percentage: '50',
  })

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
      } else {
        setUserId(user.id)
        
        // Load user profile for wallet address
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setUserProfile(profile)
      }
    }
    checkAuth()
    loadSuppliers()
  }, [router, supabase.auth])

  useEffect(() => {
    // Filter suppliers based on selected category
    const filtered = suppliers.filter(s => 
      s.categories?.includes(formData.category)
    )
    setFilteredSuppliers(filtered)
  }, [formData.category, suppliers])


  // Derive available categories from suppliers - only show categories that have suppliers
  const availableCategories = Array.from(
    new Set(
      suppliers.flatMap((s) => s.categories || []).filter(Boolean)
    )
  ).sort()

  const formatCategoryLabel = (cat: string) =>
    cat
      .split(/[\s_-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, company_name, email, address, categories, products')
      .eq('user_type', 'supplier')
      .order('company_name')
    
    setSuppliers(data || [])
  }

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSupplierSelect = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId)
    if (supplier) {
      setFormData(prev => ({
        ...prev,
        supplierId,
        supplierName: supplier.company_name,
        supplierContact: supplier.email || supplier.address || '',
      }))
    }
  }

  const totalAmount = formData.quantity && formData.pricePerUnit 
    ? Number(formData.quantity) * Number(formData.pricePerUnit) 
    : 0

  const estimatedYield = totalAmount * 0.12 * (Number(formData.term) / 365)

  const canProceedStep1 = formData.productName && formData.quantity && formData.pricePerUnit &&
    (availableCategories.length === 0 || formData.category)
  const canProceedStep2 = formData.supplierName && formData.term
  const canSubmit = canProceedStep1 && canProceedStep2

  const handleSubmit = async () => {
    if (!userId || !userProfile) return
    
    setIsLoading(true)
    try {
      // Get selected supplier - prefer ID lookup, fallback to name
      let selectedSupplier = formData.supplierId
        ? suppliers.find(s => s.id === formData.supplierId)
        : suppliers.find(s => s.company_name === formData.supplierName)

      // If address missing from cached data (or supplier not in cache), fetch fresh from Supabase
      const supplierIdToFetch = formData.supplierId || selectedSupplier?.id
      if (supplierIdToFetch && (!selectedSupplier?.address || !selectedSupplier.address.trim())) {
        const { data: freshSupplier } = await supabase
          .from('profiles')
          .select('id, company_name, address')
          .eq('id', supplierIdToFetch)
          .eq('user_type', 'supplier')
          .single()
        if (freshSupplier) {
          selectedSupplier = { ...selectedSupplier, ...freshSupplier }
        }
      }

      if (!selectedSupplier?.address || !selectedSupplier.address.trim()) {
        alert('Selected supplier does not have a Stellar wallet address configured. Please select a different supplier.')
        setIsLoading(false)
        return
      }

      // Insert deal first (without escrow info)
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          pyme_id: userId,
          title: formData.productName,
          description: formData.description || 'No description provided',
          amount: totalAmount,
          term_days: Number(formData.term),
          apr: 12,
          category: formData.category || 'other',
          status: 'open',
          supplier_name: formData.supplierName,
          supplier_contact: formData.supplierContact || null,
        })
        .select()
        .single()

      if (dealError) throw dealError

      // Insert milestones
      const milestones = [
        {
          deal_id: deal.id,
          name: formData.milestone1Name,
          percentage: Number(formData.milestone1Percentage),
          amount: (totalAmount * Number(formData.milestone1Percentage)) / 100,
          status: 'pending',
          order_index: 1,
        },
        {
          deal_id: deal.id,
          name: formData.milestone2Name,
          percentage: Number(formData.milestone2Percentage),
          amount: (totalAmount * Number(formData.milestone2Percentage)) / 100,
          status: 'pending',
          order_index: 2,
        },
      ]

      const { error: milestonesError } = await supabase
        .from('milestones')
        .insert(milestones)

      if (milestonesError) throw milestonesError

      // Initialize escrow contract on Stellar
      console.log('Initializing escrow contract...')
      const escrowResult = await initializeEscrow({
        payerPublicKey: userProfile.address || '', // PyME wallet (will be funded by investor)
        recipientPublicKey: selectedSupplier.address,
        amount: totalAmount.toString(),
        milestones: milestones.map(m => ({
          name: m.name,
          percentage: m.percentage,
          amount: m.amount.toString(),
        })),
      })

      if (escrowResult.success && escrowResult.escrowId) {
        // Update deal with escrow info
        console.log('Escrow created:', escrowResult.escrowId)
        await supabase
          .from('deals')
          .update({
            escrow_id: escrowResult.escrowId,
            contract_address: escrowResult.contractAddress || null,
            transaction_hash: escrowResult.transactionHash || null,
          })
          .eq('id', deal.id)

        router.push('/dashboard')
      } else {
        throw new Error(escrowResult.error || 'Failed to initialize escrow')
      }
    } catch (error) {
      console.error('Error creating deal:', error)
      alert(`Error creating deal: ${error instanceof Error ? error.message : 'Please try again.'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const progress = (currentStep / 3) * 100

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 pb-16">
        {/* Header */}
        <div className="mb-8">
          <Badge className="mb-3" variant="secondary">
            For PyMEs
          </Badge>
          <h1 className="mb-2 text-4xl font-bold tracking-tight">Create New Deal</h1>
          <p className="text-lg text-muted-foreground">
            Set up your purchase order and let investors fund it through secure escrow
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2">
            {/* Progress */}
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-medium">Step {currentStep} of 3</span>
                <span className="text-muted-foreground">{Math.round(progress)}% Complete</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Step 1: Deal Basics */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Deal Basics
                  </CardTitle>
                  <CardDescription>
                    Provide details about the product you need to purchase
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="productName">Product Name *</Label>
                    <Input
                      id="productName"
                      placeholder="e.g., Industrial LED Lighting Equipment"
                      value={formData.productName}
                      onChange={(e) => updateFormData('productName', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of the product and its intended use..."
                      value={formData.description}
                      onChange={(e) => updateFormData('description', e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(value) => updateFormData('category', value)}>
                      <SelectTrigger id="category">
                        <SelectValue placeholder={availableCategories.length > 0 ? "Select category" : "No categories available yet"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.length === 0 ? (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            No suppliers have added categories yet. Ask suppliers to add their products & categories in their profile.
                          </div>
                        ) : (
                          availableCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {formatCategoryLabel(cat)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {availableCategories.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Categories shown are from suppliers who have added them to their profile
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        placeholder="500"
                        value={formData.quantity}
                        onChange={(e) => updateFormData('quantity', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pricePerUnit">Price per Unit (USDC) *</Label>
                      <Input
                        id="pricePerUnit"
                        type="number"
                        placeholder="90.00"
                        value={formData.pricePerUnit}
                        onChange={(e) => updateFormData('pricePerUnit', e.target.value)}
                      />
                    </div>
                  </div>

                  {totalAmount > 0 && (
                    <div className="rounded-lg border border-accent bg-accent/5 p-4">
                      <p className="text-sm text-muted-foreground">Total Deal Amount</p>
                      <p className="text-3xl font-bold text-accent">
                        ${totalAmount.toLocaleString()} USDC
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 2: Supplier & Terms */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Supplier & Terms
                  </CardTitle>
                  <CardDescription>
                    Who will supply the product and what are the payment terms?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Select Supplier *</Label>
                    <Select 
                      value={formData.supplierId || undefined} 
                      onValueChange={handleSupplierSelect}
                    >
                      <SelectTrigger id="supplier">
                        <SelectValue placeholder={formData.supplierName || "Choose from verified suppliers"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSuppliers.length === 0 ? (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            {formData.category 
                              ? `No suppliers found for ${formData.category}`
                              : 'Select a category first to see suppliers'
                            }
                          </div>
                        ) : (
                          filteredSuppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.company_name}
                              {supplier.products && supplier.products.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {' '}• {supplier.products.slice(0, 2).join(', ')}
                                </span>
                              )}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {formData.category && (
                      <p className="text-xs text-muted-foreground">
                        Showing suppliers for: <span className="font-medium capitalize">{formData.category}</span>
                      </p>
                    )}
                  </div>

                  {formData.supplierName && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="mb-1 text-sm font-medium">Selected Supplier</p>
                      <p className="text-sm text-muted-foreground">{formData.supplierName}</p>
                      {formData.supplierContact && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Contact: {formData.supplierContact}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="term">Deal Term (Days) *</Label>
                    <Select value={formData.term} onValueChange={(value) => updateFormData('term', value)}>
                      <SelectTrigger id="term">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="45">45 days</SelectItem>
                        <SelectItem value="60">60 days</SelectItem>
                        <SelectItem value="75">75 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      This is how long you have to repay investors after delivery
                    </p>
                  </div>

                  {totalAmount > 0 && (
                    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Deal Amount</span>
                        <span className="font-semibold">${totalAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Estimated Investor Yield</span>
                        <span className="font-semibold text-success">
                          ${estimatedYield.toFixed(2)} ({((estimatedYield / totalAmount) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">You Repay (estimate)</span>
                        <span className="font-semibold">
                          ${(totalAmount + estimatedYield).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 3: Milestones */}
            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Payment Milestones
                  </CardTitle>
                  <CardDescription>
                    Define when the supplier gets paid from escrow
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                    <div className="flex gap-3">
                      <Info className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Standard Milestone Structure
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Most deals use a 50/50 split: 50% upfront after shipment confirmation, 
                          and 50% after delivery confirmation. You can customize if needed.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Milestone 1 */}
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    <h4 className="font-semibold">Milestone 1</h4>
                    <div className="space-y-2">
                      <Label htmlFor="milestone1Name">Milestone Name</Label>
                      <Input
                        id="milestone1Name"
                        value={formData.milestone1Name}
                        onChange={(e) => updateFormData('milestone1Name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="milestone1Percentage">Payment Percentage</Label>
                      <Select 
                        value={formData.milestone1Percentage} 
                        onValueChange={(value) => updateFormData('milestone1Percentage', value)}
                      >
                        <SelectTrigger id="milestone1Percentage">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50">50%</SelectItem>
                          <SelectItem value="40">40%</SelectItem>
                          <SelectItem value="60">60%</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        ${((totalAmount * Number(formData.milestone1Percentage)) / 100).toLocaleString()} USDC
                      </p>
                    </div>
                  </div>

                  {/* Milestone 2 */}
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    <h4 className="font-semibold">Milestone 2</h4>
                    <div className="space-y-2">
                      <Label htmlFor="milestone2Name">Milestone Name</Label>
                      <Input
                        id="milestone2Name"
                        value={formData.milestone2Name}
                        onChange={(e) => updateFormData('milestone2Name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="milestone2Percentage">Payment Percentage</Label>
                      <Select 
                        value={formData.milestone2Percentage} 
                        onValueChange={(value) => updateFormData('milestone2Percentage', value)}
                      >
                        <SelectTrigger id="milestone2Percentage">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50">50%</SelectItem>
                          <SelectItem value="40">40%</SelectItem>
                          <SelectItem value="60">60%</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        ${((totalAmount * Number(formData.milestone2Percentage)) / 100).toLocaleString()} USDC
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation Buttons */}
            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1) as FormStep)}
                disabled={currentStep === 1}
              >
                Back
              </Button>

              {currentStep < 3 ? (
                <Button
                  onClick={() => setCurrentStep(prev => Math.min(3, prev + 1) as FormStep)}
                  disabled={currentStep === 1 ? !canProceedStep1 : !canProceedStep2}
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!canSubmit || isLoading || isInitializing}>
                  {isLoading || isInitializing ? 'Creating Deal & Deploying Escrow...' : 'Create Deal & Deploy Escrow'}
                </Button>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Deal Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Deal Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Product</p>
                  <p className="font-medium">
                    {formData.productName || 'Not set'}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">
                    {totalAmount > 0 ? `$${totalAmount.toLocaleString()}` : '$0'}
                  </p>
                  <p className="text-xs text-muted-foreground">USDC</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p className="font-medium">
                    {formData.supplierName || 'Not set'}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Term</p>
                  <p className="font-medium">{formData.term} days</p>
                </div>
              </CardContent>
            </Card>

            {/* How It Works */}
            <Card className="border-accent">
              <CardHeader>
                <CardTitle className="text-base">How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                    1
                  </div>
                  <p className="text-muted-foreground">
                    Create your deal with product details and payment terms
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                    2
                  </div>
                  <p className="text-muted-foreground">
                    Escrow smart contract is deployed to Stellar
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                    3
                  </div>
                  <p className="text-muted-foreground">
                    Investors fund your deal through the marketplace
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                    4
                  </div>
                  <p className="text-muted-foreground">
                    Supplier ships and gets paid in milestones
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

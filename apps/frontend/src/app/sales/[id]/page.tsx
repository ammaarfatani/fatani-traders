'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toPng, toBlob } from 'html-to-image';
import jsPDF from 'jspdf';
import { api } from '@/lib/api';
import { formatPKR, formatWeight } from '@fatani/shared';
import { normalizeWhatsAppNumber, buildWhatsAppLink } from '@/lib/phoneUtils';
import { FATANI_LOGO_BASE64 } from '@/lib/logoBase64';
import {
  ArrowLeft,
  Printer,
  Share2,
  Phone,
  MapPin,
  CheckCircle,
  CheckCircle2,
  Copy,
  Plus,
  Banknote,
  Calendar,
  X,
  CreditCard,
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  Download,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Loader2,
  ExternalLink,
  Edit,
  Trash2,
} from 'lucide-react';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import { EditSaleModal } from '@/components/sales/EditSaleModal';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const [layoutMode, setLayoutMode] = useState<'a4' | 'thermal'>('a4');
  const [copied, setCopied] = useState(false);
  const [printTipVisible, setPrintTipVisible] = useState(false);

  // Export & Share Processing States
  const [isGeneratingWhatsApp, setIsGeneratingWhatsApp] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // WhatsApp Share Modal State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppPreviewUrl, setWhatsAppPreviewUrl] = useState<string | null>(null);
  const [whatsAppBlob, setWhatsAppBlob] = useState<Blob | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit / Delete State
  const [isEditSaleOpen, setIsEditSaleOpen] = useState(false);
  const [isDeleteSaleOpen, setIsDeleteSaleOpen] = useState(false);

  const handleDeleteSale = async () => {
    await api.delete(`/sales/${id}`);
    queryClient.invalidateQueries();
    router.push('/sales');
  };

  // Detect native file sharing capability (Web Share API Level 2)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
      try {
        const dummyFile = new File(['test'], 'test.png', { type: 'image/png' });
        setCanShareFiles(navigator.canShare({ files: [dummyFile] }));
      } catch {
        setCanShareFiles(false);
      }
    }
  }, []);

  const { data: sale, isLoading, error } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => api.get<any>(`/sales/${id}`),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (payload: any) => api.post('/payments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      setModalError(null);
    },
    onError: (err: any) => {
      setModalError(err.message || 'Failed to record payment');
    },
  });

  const handleOpenPaymentModal = () => {
    if (sale) {
      setPaymentAmount(sale.balanceAmount);
      setPaymentRef(`Payment for ${sale.invoiceNumber}`);
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setModalError(null);
      setIsPaymentModalOpen(true);
    }
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setModalError('Payment amount must be greater than zero');
      return;
    }
    setModalError(null);
    recordPaymentMutation.mutate({
      type: 'CUSTOMER_PAYMENT',
      customerId: sale.customerId,
      saleId: sale.id,
      amount: Number(paymentAmount),
      paymentDate: new Date(paymentDate).toISOString(),
      referenceNumber: paymentRef || sale.invoiceNumber,
      notes: paymentNotes || undefined,
    });
  };

  const snapshot = sale?.invoiceSnapshot;

  // Text summary helper for messaging
  const getWhatsAppMessage = () => {
    if (!sale) return '';
    const customerName = snapshot?.customer?.name || sale.customer?.name || 'Customer';
    const invNo = sale.invoiceNumber;
    const date = new Date(sale.invoiceDate).toLocaleDateString();
    const grandTotal = formatPKR(sale.grandTotal);
    const paid = formatPKR(sale.paidAmount);
    const bal = formatPKR(sale.balanceAmount);

    return (
      `*FATANI TRADERS — SALES INVOICE*\n` +
      `----------------------------\n` +
      `Invoice #: ${invNo}\n` +
      `Date: ${date}\n` +
      `Customer: ${customerName}\n\n` +
      `*Grand Total:* ${grandTotal}\n` +
      `Amount Paid: ${paid}\n` +
      `*Balance Due:* ${bal}\n` +
      `----------------------------\n` +
      `Thank you for doing business with Fatani Traders!`
    );
  };

  /**
   * High-Resolution Invoice Image Rendering
   * Captures the full printable document including long multi-product items without clipping.
   */
  const renderInvoiceImage = async (): Promise<{ dataUrl: string; blob: Blob } | null> => {
    const element = document.getElementById('invoice-printable-area');
    if (!element) return null;

    // Save current scroll & viewport styling to ensure complete uncropped render
    const origTransform = element.style.transform;
    element.style.transform = 'none';

    try {
      const dataUrl = await toPng(element, {
        quality: 0.98,
        pixelRatio: 2.5, // Crisp 2.5x retina density for sharp text and logo
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      const blob = await toBlob(element, {
        quality: 0.98,
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      if (!blob) throw new Error('Blob conversion failed');
      return { dataUrl, blob };
    } finally {
      element.style.transform = origTransform;
    }
  };

  /**
   * Action 1: WhatsApp Share Workflow
   * Generates invoice PNG, checks customer phone number, and opens interactive share modal
   */
  const handleOpenWhatsAppShare = async () => {
    if (!sale) return;
    setIsGeneratingWhatsApp(true);
    try {
      const result = await renderInvoiceImage();
      if (!result) throw new Error('Failed to render invoice image');
      setWhatsAppPreviewUrl(result.dataUrl);
      setWhatsAppBlob(result.blob);
      setIsWhatsAppModalOpen(true);
    } catch (err: any) {
      console.error('WhatsApp image generation error:', err);
      alert('Could not render invoice image. Please check your browser connection.');
    } finally {
      setIsGeneratingWhatsApp(false);
    }
  };

  /**
   * Native Device Share Sheet (Mobile Android/iOS)
   */
  const handleExecuteNativeShare = async () => {
    if (!whatsAppBlob || !sale) return;
    const filename = `Fatani_Traders_Invoice_${sale.invoiceNumber}.png`;
    const file = new File([whatsAppBlob], filename, { type: 'image/png' });
    const customerName = snapshot?.customer?.name || sale.customer?.name || 'Customer';
    const text = `Assalam-o-Alaikum ${customerName}, please find attached your sales invoice #${sale.invoiceNumber} for PKR ${formatPKR(sale.grandTotal)}. Thank you! — Fatani Traders`;

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Fatani Traders Invoice #${sale.invoiceNumber}`,
          text,
        });
        setIsWhatsAppModalOpen(false);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Native share failed:', err);
        }
      }
    }
  };

  /**
   * Direct WhatsApp Chat Link with Pre-filled Message & Auto Image Download
   */
  const handleExecuteDirectWhatsApp = () => {
    if (!sale) return;
    const phoneRes = normalizeWhatsAppNumber(sale.customer?.phone || snapshot?.customer?.phone);

    // Auto-trigger download of invoice PNG so user has it immediately ready in gallery/downloads to attach
    if (whatsAppPreviewUrl) {
      const link = document.createElement('a');
      link.download = `Fatani_Traders_Invoice_${sale.invoiceNumber}.png`;
      link.href = whatsAppPreviewUrl;
      link.click();
    }

    const customerName = snapshot?.customer?.name || sale.customer?.name || 'Customer';
    const message =
      `Assalam-o-Alaikum ${customerName},\n\n` +
      `Please find attached sales invoice *#${sale.invoiceNumber}*.\n` +
      `• Invoice Date: ${new Date(sale.invoiceDate).toLocaleDateString()}\n` +
      `• Total Amount: ${formatPKR(sale.grandTotal)}\n` +
      `• Amount Paid: ${formatPKR(sale.paidAmount)}\n` +
      `• Balance Due: ${formatPKR(sale.balanceAmount)}\n\n` +
      `Thank you for doing business with Fatani Traders!`;

    const url = buildWhatsAppLink(phoneRes.normalized, message);
    window.open(url, '_blank');
  };

  /**
   * Action 2: Download Invoice Image (PNG)
   */
  const handleDownloadImage = async () => {
    if (!sale) return;
    setIsGeneratingImage(true);
    try {
      const result = await renderInvoiceImage();
      if (!result) throw new Error('Render failed');
      const link = document.createElement('a');
      link.download = `Fatani_Traders_Invoice_${sale.invoiceNumber}.png`;
      link.href = result.dataUrl;
      link.click();
    } catch (err: any) {
      console.error('Image download error:', err);
      alert('Failed to download invoice image.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  /**
   * Action 3: Download Clean A4 PDF
   */
  const handleDownloadPdf = async () => {
    if (!sale) return;
    setIsGeneratingPdf(true);
    try {
      const result = await renderInvoiceImage();
      if (!result) throw new Error('Render failed');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgProps = pdf.getImageProperties(result.dataUrl);
      const pdfWidth = 210; // Standard A4 width in mm
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      const pageHeight = 297; // Standard A4 height in mm

      if (pdfHeight <= pageHeight) {
        pdf.addImage(result.dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      } else {
        // Multi-page slicing for large multi-product fabric invoices
        let heightLeft = pdfHeight;
        let position = 0;

        pdf.addImage(result.dataUrl, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position -= pageHeight;
          pdf.addPage();
          pdf.addImage(result.dataUrl, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
          heightLeft -= pageHeight;
        }
      }

      pdf.save(`Fatani_Traders_Invoice_${sale.invoiceNumber}.pdf`);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. You can also use Print Invoice.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  /**
   * Action 4: Clean Browser Printing
   */
  const handlePrint = () => {
    setPrintTipVisible(true);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getWhatsAppMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-10 h-10 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
          Loading Invoice #{id}...
        </p>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm max-w-lg mx-auto my-12 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
        <h3 className="font-bold text-base">Invoice Not Found</h3>
        <p className="text-xs text-red-600">
          The requested sales invoice could not be located in the system.
        </p>
        <Link
          href="/sales"
          className="inline-block px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition"
        >
          Return to Sales History
        </Link>
      </div>
    );
  }

  const business = snapshot?.business || {
    name: 'Fatani Traders',
    tagline: 'Wholesale Fabric & Textile Trading',
    phone: '+92 300 1234567',
    address: 'Shop # 14, Textile Plaza, M.A. Jinnah Road, Karachi, Pakistan',
    ntn: '42101-1234567-1',
  };

  const template = snapshot?.template || {
    primaryColor: '#172F35',
    footerText:
      'Thank you for your business! No claims or returns accepted after fabric is cut, washed, or dyed.',
    termsAndConditions:
      '1. Payment is due as agreed.\n2. In case of quality dispute, return intact rolls within 3 business days.\n3. Goods sold by weight in Kilograms and Grams.',
    showPreviousBalance: true,
    showTotalOutstanding: true,
  };

  const customer = snapshot?.customer || {
    name: sale.customer?.name,
    phone: sale.customer?.phone,
    address: sale.customer?.address,
    previousBalance: 0,
  };

  const phoneRes = normalizeWhatsAppNumber(sale.customer?.phone || customer.phone);
  const currentTotalDue = sale.customer?.currentBalance ?? sale.balanceAmount;
  const paymentAllocations = sale.paymentAllocations || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Top Action Bar (Completely hidden on print) */}
      <div className="print:hidden no-print bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/sales"
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-brand-fabric transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sales</span>
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          {sale.balanceAmount > 0 && (
            <button
              onClick={handleOpenPaymentModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-sm transition active:scale-95"
            >
              <Banknote className="w-4 h-4" />
              <span>+ Record Payment</span>
            </button>
          )}

          {/* Format Selector */}
          <div className="flex bg-brand-light p-1 rounded-xl border border-brand-muted text-xs">
            <button
              onClick={() => setLayoutMode('a4')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                layoutMode === 'a4'
                  ? 'bg-brand-deep text-white shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              A4
            </button>
            <button
              onClick={() => setLayoutMode('thermal')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                layoutMode === 'thermal'
                  ? 'bg-brand-deep text-white shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              80mm
            </button>
          </div>

          {/* Share on WhatsApp Button */}
          <button
            onClick={handleOpenWhatsAppShare}
            disabled={isGeneratingWhatsApp}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-60"
            title="Share complete invoice image on WhatsApp"
          >
            {isGeneratingWhatsApp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            <span>{isGeneratingWhatsApp ? 'Generating...' : 'WhatsApp Share'}</span>
          </button>

          {/* Download Image Button */}
          <button
            onClick={handleDownloadImage}
            disabled={isGeneratingImage}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-sm transition active:scale-95 disabled:opacity-60"
            title="Download high-resolution invoice PNG"
          >
            {isGeneratingImage ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImageIcon className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">PNG Image</span>
          </button>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs shadow-sm transition active:scale-95 disabled:opacity-60"
            title="Download clean A4 PDF document"
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">PDF</span>
          </button>

          {/* Print Invoice Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-semibold text-xs shadow-sm transition active:scale-95"
            title="Print clean A4 invoice"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>

          {/* Copy Text Summary Button */}
          <button
            onClick={handleCopyText}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-brand-light hover:bg-brand-muted text-gray-700 font-semibold text-xs border border-brand-muted transition active:scale-95"
            title="Copy text summary"
          >
            {copied ? (
              <CheckCircle className="w-4 h-4 text-emerald-700" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Edit Sale Invoice Button */}
          <button
            onClick={() => setIsEditSaleOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-muted hover:bg-brand-light text-brand-charcoal font-semibold text-xs transition active:scale-95"
            title="Edit Sales Invoice"
          >
            <Edit className="w-3.5 h-3.5 text-gray-500" />
            <span>Edit</span>
          </button>

          {/* Delete Sale Invoice Button */}
          <button
            onClick={() => setIsDeleteSaleOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs transition active:scale-95"
            title="Delete Sales Invoice"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Print Instructions Banner (Shown briefly after clicking print) */}
      {printTipVisible && (
        <div className="print:hidden no-print p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Clean A4 Print Tip:</strong> For standard clean invoice output without browser URLs
              or date footers, uncheck <em>&quot;Headers and footers&quot;</em> in your browser print window.
            </span>
          </div>
          <button
            onClick={() => setPrintTipVisible(false)}
            className="text-amber-700 hover:text-amber-900 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Invoice Document Paper Container (Pure invoice element captured for Print, PNG, PDF & WhatsApp) */}
      <div
        id="invoice-printable-area"
        className={`bg-white rounded-3xl border border-brand-muted shadow-card transition-all mx-auto print:border-none print:shadow-none print:rounded-none print:p-0 ${
          layoutMode === 'thermal'
            ? 'w-full max-w-[80mm] p-4 text-[11px] leading-tight font-mono'
            : 'w-full p-8 sm:p-12 text-sm leading-normal'
        }`}
      >
        {/* Invoice Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-brand-muted pb-6">
          <div className="flex items-center gap-4">
            {/* Original Fatani Fabrics Logo */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center">
              <img
                src={FATANI_LOGO_BASE64}
                alt="Fatani Fabrics Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-brand-charcoal tracking-tight font-sans">
                {business.name}
              </h2>
              <p className="text-xs text-brand-fabric font-bold uppercase tracking-wider">
                {business.tagline}
              </p>
              <div className="text-xs text-gray-500 mt-1.5 space-y-0.5">
                <p className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <span>{business.address}</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <span>{business.phone}</span>
                  {business.ntn && (
                    <span className="ml-2 font-mono font-medium text-gray-600">
                      NTN: {business.ntn}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <div className="inline-block bg-brand-light px-3 py-1 rounded-lg text-brand-fabric font-bold text-xs uppercase tracking-wider mb-2">
              Sales Tax Invoice
            </div>
            <p className="text-base sm:text-lg font-black text-brand-charcoal font-mono">
              #{sale.invoiceNumber}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Date:{' '}
              <span className="font-semibold text-gray-700">
                {new Date(sale.invoiceDate).toLocaleDateString()}
              </span>
            </p>
            <p className="text-xs text-gray-500">
              Payment Status:{' '}
              <span
                className={`font-bold ${
                  sale.status === 'COMPLETED'
                    ? 'text-emerald-700'
                    : sale.status === 'PARTIAL'
                    ? 'text-amber-700'
                    : 'text-red-700'
                }`}
              >
                {sale.status}
              </span>
            </p>
          </div>
        </div>

        {/* Billed To Section */}
        <div className="my-6 p-4 rounded-2xl bg-brand-light/60 border border-brand-muted/80 flex flex-col sm:flex-row justify-between gap-4 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
              Billed To (Customer):
            </span>
            <p className="text-sm font-bold text-brand-charcoal">{customer.name}</p>
            {phoneRes.isValid ? (
              <p className="text-gray-700 mt-0.5 font-mono font-semibold flex items-center gap-1">
                <span>{phoneRes.display}</span>
              </p>
            ) : (
              <p className="text-gray-400 mt-0.5 italic text-[11px]">No phone number saved</p>
            )}
            {customer.address && <p className="text-gray-500 mt-0.5">{customer.address}</p>}
          </div>

          {template.showPreviousBalance && (
            <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-brand-muted">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                Customer DigiKhata Ledger:
              </span>
              <p className="text-gray-600">
                Net Outstanding Balance:{' '}
                <strong className="text-brand-charcoal">{formatPKR(currentTotalDue)}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto my-6">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-brand-muted text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 text-left">#</th>
                <th className="py-2.5 text-left">Fabric Description & Roll</th>
                <th className="py-2.5 text-right">Net Weight</th>
                <th className="py-2.5 text-right">Rate / KG</th>
                <th className="py-2.5 text-right">Total (PKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sale.items?.map((it: any, index: number) => (
                <tr key={it.id || index} className="hover:bg-brand-light/20 avoid-break">
                  <td className="py-3 text-gray-400 font-mono">{index + 1}</td>
                  <td className="py-3 pr-2">
                    <p className="font-bold text-brand-charcoal">
                      {it.product?.name || 'Fabric Roll'}
                    </p>
                    {it.lot?.lotNumber && (
                      <p className="text-[10px] text-brand-fabric font-mono">
                        Lot #{it.lot.lotNumber}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-gray-700">
                    {formatWeight(it.grams)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-gray-600">
                    {formatPKR(it.ratePerKg)}
                  </td>
                  <td className="py-3 pl-2 text-right font-bold text-brand-charcoal">
                    {formatPKR(it.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="border-t border-brand-muted pt-4 flex flex-col sm:flex-row justify-between gap-6 avoid-break">
          <div className="sm:max-w-xs space-y-3 text-xs">
            {sale.notes && (
              <div>
                <span className="font-semibold text-brand-charcoal">Remarks:</span>
                <p className="text-gray-500 mt-0.5">{sale.notes}</p>
              </div>
            )}

            {template.termsAndConditions && (
              <div className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-2">
                <span className="font-semibold text-gray-600 block mb-0.5">
                  Terms & Conditions:
                </span>
                <p className="whitespace-pre-line">{template.termsAndConditions}</p>
              </div>
            )}
          </div>

          <div className="w-full sm:w-64 space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-semibold">{formatPKR(sale.subtotal)}</span>
            </div>

            {sale.discount > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Discount:</span>
                <span className="font-semibold">-{formatPKR(sale.discount)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-extrabold text-brand-charcoal border-t border-brand-muted pt-2">
              <span>Grand Total:</span>
              <span>{formatPKR(sale.grandTotal)}</span>
            </div>

            <div className="flex justify-between text-emerald-700">
              <span>Payment Received:</span>
              <span className="font-semibold">{formatPKR(sale.paidAmount)}</span>
            </div>

            <div className="flex justify-between text-sm font-extrabold text-red-600 border-t border-brand-muted pt-2">
              <span>Remaining Amount Due:</span>
              <span>{formatPKR(sale.balanceAmount)}</span>
            </div>

            {template.showTotalOutstanding && (
              <div className="p-2.5 rounded-xl bg-brand-deep text-white flex justify-between items-center text-xs font-bold mt-2 shadow-sm">
                <span>Total Khata Balance:</span>
                <span className="text-emerald-300 text-sm">{formatPKR(currentTotalDue)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer & Signature Section */}
        <div className="mt-10 pt-6 border-t border-brand-muted flex flex-col sm:flex-row justify-between items-end gap-6 text-xs text-gray-400 avoid-break">
          <div>
            <p className="font-medium text-gray-500">{template.footerText}</p>
            <p className="text-[10px] text-gray-400 mt-1">
              Generated electronically by Fatani Traders Textile ERP.
            </p>
          </div>

          <div className="text-center sm:text-right pt-6 sm:pt-0">
            <div className="w-40 border-b border-gray-400 mb-1" />
            <span className="text-[11px] font-semibold text-gray-600">Authorized Signature</span>
          </div>
        </div>
      </div>

      {/* Linked Payment Transactions History Section (Completely hidden on Print) */}
      <div className="print:hidden no-print bg-white p-5 sm:p-6 rounded-3xl border border-brand-muted shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-emerald-700" />
            <h3 className="text-base font-bold text-brand-charcoal">
              Payment Transactions History
            </h3>
          </div>
          {sale.balanceAmount > 0 && (
            <button
              onClick={handleOpenPaymentModal}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition"
            >
              + Record Payment
            </button>
          )}
        </div>

        {paymentAllocations.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400 space-y-2">
            <p>No payments recorded for this invoice yet.</p>
            <p className="text-red-600 font-semibold">
              Remaining balance due: {formatPKR(sale.balanceAmount)}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-left font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Payment #</th>
                  <th className="py-2.5">Reference / Notes</th>
                  <th className="py-2.5 text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paymentAllocations.map((alloc: any) => {
                  const p = alloc.payment;
                  return (
                    <tr key={alloc.id} className="hover:bg-brand-light/30">
                      <td className="py-3 text-gray-600 font-medium">
                        {p?.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 font-mono font-bold text-brand-charcoal">
                        {p?.paymentNumber || 'Direct Allocation'}
                      </td>
                      <td className="py-3 text-gray-500">
                        {p?.referenceNumber || p?.notes || 'Invoice Payment'}
                      </td>
                      <td className="py-3 text-right font-extrabold text-emerald-700">
                        +{formatPKR(alloc.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* WhatsApp Share Modal (Task 1) */}
      {isWhatsAppModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-brand-muted space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center font-bold">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-brand-charcoal">
                    Share Complete Invoice on WhatsApp
                  </h3>
                  <p className="text-[11px] text-gray-500">Invoice #{sale.invoiceNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Recipient Info */}
            <div className="p-4 rounded-2xl bg-brand-light border border-brand-muted space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Target Customer
                </span>
                {phoneRes.isValid ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Verified Number
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                    No Phone Saved
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-brand-charcoal">{customer.name}</p>
              {phoneRes.isValid ? (
                <p className="text-xs font-mono font-semibold text-emerald-700 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{phoneRes.display}</span>
                </p>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    No phone number is saved for <strong>{customer.name}</strong>. You can still
                    download the invoice image below or share via your device&apos;s share sheet.
                  </span>
                </div>
              )}
            </div>

            {/* Generated Invoice Image Thumbnail Preview */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Generated High-Resolution Invoice Document
              </span>
              <div className="border border-brand-muted rounded-2xl overflow-hidden max-h-56 overflow-y-auto bg-gray-50 p-2 shadow-inner">
                {whatsAppPreviewUrl ? (
                  <img
                    src={whatsAppPreviewUrl}
                    alt="Invoice Preview"
                    className="w-full h-auto rounded-lg shadow-xs"
                  />
                ) : (
                  <div className="py-12 text-center text-xs text-gray-400">Loading preview...</div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2 border-t border-gray-100">
              {canShareFiles && (
                <button
                  type="button"
                  onClick={handleExecuteNativeShare}
                  className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Image Directly via WhatsApp App</span>
                </button>
              )}

              {phoneRes.isValid && (
                <button
                  type="button"
                  onClick={handleExecuteDirectWhatsApp}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 ${
                    canShareFiles
                      ? 'bg-brand-light hover:bg-brand-muted text-brand-charcoal border border-brand-muted'
                      : 'bg-[#25D366] hover:bg-[#20ba5a] text-white'
                  }`}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>
                    Open Chat with {phoneRes.display} (Auto-Downloads PNG)
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadImage}
                className="w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>Download PNG to Device</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-brand-muted space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-base text-brand-charcoal">Receive Payment</h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Customer</label>
                <input
                  type="text"
                  value={customer.name}
                  disabled
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl font-bold text-brand-charcoal"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Invoice Total</label>
                  <input
                    type="text"
                    value={formatPKR(sale.grandTotal)}
                    disabled
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-red-600 block mb-1">Balance Due</label>
                  <input
                    type="text"
                    value={formatPKR(sale.balanceAmount)}
                    disabled
                    className="w-full px-3 py-2 bg-red-50 border border-red-200 rounded-xl font-bold text-red-700"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-brand-charcoal block mb-1">
                  Payment Amount Received (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={sale.balanceAmount}
                  value={paymentAmount}
                  onChange={(e) =>
                    setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full px-3.5 py-2.5 border border-brand-muted rounded-xl text-sm font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder="Enter received amount"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Payment Reference (Cash / Bank Transfer Ref)
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric"
                  placeholder="e.g. Cash, Cheque #1029, Meezan online"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Notes (Optional)</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric"
                  placeholder="Additional remarks..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-sm transition disabled:opacity-50"
                >
                  {recordPaymentMutation.isPending ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Sale Modal */}
      {sale && (
        <EditSaleModal
          isOpen={isEditSaleOpen}
          onClose={() => setIsEditSaleOpen(false)}
          sale={sale}
          onSuccess={() => {
            queryClient.invalidateQueries();
            queryClient.invalidateQueries();
          }}
        />
      )}

      {/* Delete Sale Confirmation Modal */}
      {sale && (
        <ConfirmDeleteModal
          isOpen={isDeleteSaleOpen}
          onClose={() => setIsDeleteSaleOpen(false)}
          onConfirm={handleDeleteSale}
          title="Delete Sales Invoice"
          description="Are you sure you want to permanently delete this sales invoice? This action will reverse inventory deductions and restore customer Khata balance."
          itemIdentifier={`${sale.invoiceNumber} (${sale.customer?.name})`}
          consequences={[
            `Removes sales invoice ${sale.invoiceNumber}.`,
            'Restores inventory quantities to the respective purchase lots.',
            `Credits customer balance by ${formatPKR(sale.grandTotal)} (removes invoice debit).`,
            'Protected: If any customer payments or sales returns are linked to this invoice, deletion will be blocked.',
          ]}
          confirmButtonText="Delete Invoice"
        />
      )}
    </div>
  );
}

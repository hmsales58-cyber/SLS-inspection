import React, { useState, useRef, useEffect } from 'react';
import { InspectionItem, ReportHeader, DEFAULT_HEADER, ChecklistState, DEFAULT_CHECKLIST, CHECKLIST_ITEMS, ChecklistItemKey } from './types';
import { extractDataFromImage } from './services/geminiService';
import { PrintLayout } from './components/PrintLayout';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Camera, 
  Trash2, 
  Loader2, 
  AlertCircle,
  Share2,
  Download,
  PackageCheck,
  ShieldAlert,
  Smartphone,
  Power,
  SmartphoneNfc,
  TriangleAlert,
  PackageOpen,
  Sticker,
  Sparkles,
  Package,
  FolderOpen,
  Archive,
  Calculator,
  CheckCircle2
} from 'lucide-react';

const CHECKLIST_ICONS: Record<string, React.ElementType> = {
  'PACK ORIGINAL': PackageCheck,
  'BOX OUT SIDE DAMAGE': TriangleAlert,
  'OUT SIDE DAMAGE': ShieldAlert,
  'PACK OPEN': PackageOpen,
  'DAMAGE PCS': SmartphoneNfc,
  'ACTIVE PCS': Power,
  'UNCLEAN / STICKER BOX': Sparkles,
  'LOOSE BOX': Package,
  'OPEN MASTER': FolderOpen,
  'MASTER': Archive,
  'STICKERS PCS': Sticker
};

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' }> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  ...props 
}) => {
  const baseStyle = "px-6 py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md";
  const variants = {
    primary: "bg-[#000000] text-white hover:bg-slate-800",
    secondary: "bg-slate-100 text-black hover:bg-slate-200",
    outline: "border-2 border-black text-black bg-white hover:bg-black hover:text-white"
  };
  return <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

const App: React.FC = () => {
  const [header, setHeader] = useState<ReportHeader>(DEFAULT_HEADER);
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistState>(DEFAULT_CHECKLIST);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    setHeader(prev => ({ ...prev, startTime: timeString, endTime: timeString }));
  }, []);

  const totalQty = items.reduce((sum, item) => sum + (Number(item.pcs) || 0), 0);

  const handleHeaderChange = (field: keyof ReportHeader, value: string) => {
    setHeader(prev => ({ ...prev, [field]: value }));
  };

  const handleChecklistChange = (key: ChecklistItemKey, field: 'checked' | 'count', value: any) => {
    let finalValue = value;
    if (field === 'count') {
      finalValue = Math.max(0, parseInt(value) || 0);
    }
    setChecklist(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: finalValue }
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsProcessing(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        try {
          const extractedData = await extractDataFromImage(base64Data);
          if (extractedData.company || extractedData.customerCode) {
            setHeader(prev => ({
              ...prev,
              companyName: extractedData.company || prev.companyName,
              customerCode: extractedData.customerCode || prev.customerCode
            }));
          }
          const newItems: InspectionItem[] = (extractedData.items || []).map(item => ({
            ...item,
            id: Math.random().toString(36).substr(2, 9),
          }));
          setItems(prev => [...prev, ...newItems]);
        } catch (err) {
          setError("Audit integrity failure. Manual entry required.");
        } finally {
          setIsProcessing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
    } catch (err) {
      setError("Error reading label.");
      setIsProcessing(false);
    }
  };

  const addItemManual = () => {
    setItems(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      model: "",
      gb: "",
      pcs: 1,
      color: "",
      coo: "",
      spec: "",
      remarks: ""
    }]);
  };

  const updateItem = (id: string, field: keyof InspectionItem, value: any) => {
    let finalValue = value;
    if (field === 'pcs') {
      finalValue = Math.max(0, parseInt(value) || 0);
    }
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: finalValue } : item));
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Header Branding
    doc.setFillColor(0, 0, 0);
    doc.circle(pageWidth / 2, 25, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text("SECURED", pageWidth / 2, 23, { align: 'center' });
    doc.setFontSize(4);
    doc.text("LOGISTICS SOLUTION", pageWidth / 2, 27, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Secured Logistics Solution FZCO", pageWidth / 2, 52, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Dubai Airport Free Zone | UAE", pageWidth / 2, 57, { align: "center" });

    // Client Info Table
    autoTable(doc, {
      startY: 65,
      body: [
        ["Company:", header.companyName || "-", "Customer Code:", header.customerCode || "-"],
        ["Start Time:", header.startTime, "End Time:", header.endTime],
        ["Date:", header.date, "Auditor:", header.checkedBy]
      ],
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } }
    });

    // Device Table
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Model", "RAM/GB", "Color", "SPEC", "Qty"]],
      body: items.map(i => [i.model, i.gb, i.color, i.spec, i.pcs]),
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], halign: 'center' },
      styles: { fontSize: 8, halign: 'center', textColor: [0, 0, 0] },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
    });

    // Total Row
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY,
      body: [["TOTAL UNITS AUDITED", totalQty]],
      theme: 'grid',
      styles: { fontSize: 10, fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] },
      columnStyles: { 1: { halign: 'center', cellWidth: 30 } }
    });

    // Checklist Section
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("COMPLIANCE CHECKLIST RESULTS:", 14, doc.lastAutoTable.finalY + 15);
    
    const checklistData = CHECKLIST_ITEMS
      .filter(key => checklist[key].checked)
      .map(key => [key, checklist[key].count]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [["Inspection Category", "Verified Count"]],
      body: checklistData.length > 0 ? checklistData : [["No issues reported", "-"]],
      theme: 'striped',
      headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255] },
      styles: { fontSize: 8 }
    });

    // Signature
    const finalY = doc.lastAutoTable.finalY + 30;
    doc.line(14, finalY, 70, finalY);
    doc.text("Auditor Signature", 14, finalY + 5);
    doc.text(header.checkedBy, 14, finalY + 12);

    doc.save(`Secured_Inspection_${header.customerCode || 'Report'}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-black pb-40 font-sans">
      <div className="print:hidden max-w-lg mx-auto p-4 space-y-6">
        
        {/* BRANDING HEADER */}
        <div className="flex flex-col items-center pt-10 pb-4 text-center">
            <div className="w-32 h-32 rounded-full flex items-center justify-center mb-6 relative overflow-hidden bg-black border-4 border-black shadow-2xl">
                <img src="logo.png" alt="Secured" className="w-full h-full object-contain p-2" onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) {
                        const placeholder = document.createElement('div');
                        placeholder.className = "flex flex-col items-center justify-center text-white p-4 text-center";
                        placeholder.innerHTML = `<span class="text-xl font-black italic leading-none">SECURED</span><span class="text-[5px] font-bold mt-1 tracking-widest uppercase opacity-80">LOGISTICS SOLUTION</span>`;
                        parent.appendChild(placeholder);
                    }
                }} />
            </div>
            <h1 className="text-2xl font-black text-black tracking-tight uppercase">Secured Logistics Solution FZCO</h1>
            <div className="text-[11px] font-black text-slate-500 mt-2 uppercase tracking-widest">
                 <p>Dubai Airport Free Zone | UAE</p>
            </div>
        </div>

        {/* HEADER INPUTS */}
        <div className="bg-white p-6 rounded-3xl shadow-lg border-2 border-slate-100 grid grid-cols-2 gap-5">
            <div className="col-span-2 grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] font-black text-black uppercase mb-1.5 block px-1">Customer Code</label>
                    <input className="w-full font-mono font-bold text-lg bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-black text-black" value={header.customerCode} onChange={e => handleHeaderChange('customerCode', e.target.value)} onFocus={e => e.target.select()} placeholder="C-000" />
                </div>
                <div>
                    <label className="text-[10px] font-black text-black uppercase mb-1.5 block px-1">Company</label>
                    <input className="w-full font-black text-lg bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-black text-black" value={header.companyName} onChange={e => handleHeaderChange('companyName', e.target.value)} onFocus={e => e.target.select()} placeholder="Client Name" />
                </div>
            </div>
            <div>
                <label className="text-[10px] font-black text-black uppercase mb-1.5 block px-1">Start Time</label>
                <input type="time" className="w-full font-black bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 outline-none text-black" value={header.startTime} onChange={e => handleHeaderChange('startTime', e.target.value)} />
            </div>
            <div>
                <label className="text-[10px] font-black text-black uppercase mb-1.5 block px-1">End Time</label>
                <input type="time" className="w-full font-black bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 outline-none text-black" value={header.endTime} onChange={e => handleHeaderChange('endTime', e.target.value)} />
            </div>
        </div>

        {/* SCAN ACTION */}
        <div className="relative">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isProcessing} 
                className={`w-full py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-2xl ${isProcessing ? 'bg-slate-200 text-slate-400' : 'bg-black text-white'}`}
            >
                {isProcessing ? <Loader2 className="w-7 h-7 animate-spin" /> : <Camera className="w-7 h-7" />}
                {isProcessing ? "VERIFYING DATA..." : "SCAN DEVICE LABEL"}
            </button>
            {error && <div className="absolute -bottom-6 left-0 w-full text-center text-[10px] text-red-600 font-black uppercase tracking-widest">{error}</div>}
        </div>

        {/* INVENTORY LIST */}
        <div className="space-y-4 pt-2">
            <div className="flex justify-between items-center px-2">
                <h2 className="text-[13px] font-black text-black uppercase tracking-widest">Inventory Audit</h2>
                <button onClick={addItemManual} className="text-[11px] font-black bg-black text-white px-5 py-2.5 rounded-full uppercase transition-all">+ New Entry</button>
            </div>
            
            {items.map(item => (
                <div key={item.id} className="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-slate-100 relative">
                    <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} className="absolute top-6 right-6 text-slate-300 hover:text-red-600 transition-colors"><Trash2 className="w-6 h-6" /></button>
                    
                    <div className="mb-5 pr-12">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Manufacturer Model</label>
                        <input value={item.model} onChange={e => updateItem(item.id, 'model', e.target.value)} className="w-full text-2xl font-black text-black outline-none border-b-4 border-transparent focus:border-slate-100 bg-white" placeholder="Samsung A36 5G" onFocus={e => e.target.select()} />
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-5">
                        <div className="bg-white p-3 rounded-2xl border-2 border-slate-100">
                            <label className="text-[8px] font-black text-slate-400 block uppercase mb-1">RAM/GB</label>
                            <input value={item.gb} onChange={e => updateItem(item.id, 'gb', e.target.value)} className="w-full font-black text-sm outline-none bg-transparent text-black" placeholder="8/128GB" onFocus={e => e.target.select()} />
                        </div>
                        <div className="bg-white p-3 rounded-2xl border-2 border-slate-100 col-span-2">
                            <label className="text-[8px] font-black text-slate-400 block uppercase mb-1">Color</label>
                            <input value={item.color} onChange={e => updateItem(item.id, 'color', e.target.value)} className="w-full font-black text-sm outline-none bg-transparent text-black" placeholder="Awesome Black" onFocus={e => e.target.select()} />
                        </div>
                        <div className="bg-white p-3 rounded-2xl border-2 border-slate-100">
                            <label className="text-[8px] font-black text-slate-400 block uppercase mb-1">COO</label>
                            <input value={item.coo} onChange={e => updateItem(item.id, 'coo', e.target.value)} className="w-full font-black text-sm outline-none bg-transparent text-black" placeholder="Origin" onFocus={e => e.target.select()} />
                        </div>
                    </div>

                    <div className="flex gap-5 items-center bg-slate-50 p-5 rounded-3xl border-2 border-slate-100">
                        <div className="flex items-center gap-4 border-r-4 border-white pr-8">
                            <span className="text-[11px] font-black text-slate-400 uppercase">Qty</span>
                            <input type="number" min="0" value={item.pcs} onChange={e => updateItem(item.id, 'pcs', e.target.value)} className="w-14 font-black text-3xl text-black bg-transparent outline-none text-center" onFocus={e => e.target.select()} />
                        </div>
                        <div className="flex-1">
                            <span className="text-[11px] font-black text-slate-400 uppercase block mb-1">SPEC (Part Number)</span>
                            <input value={item.spec} onChange={e => updateItem(item.id, 'spec', e.target.value)} className="w-full font-mono font-black text-sm outline-none bg-transparent text-black uppercase tracking-widest" placeholder="SM-A366BZKPMEA" onFocus={e => e.target.select()} />
                        </div>
                    </div>
                </div>
            ))}

            {items.length > 0 && (
                <div className="bg-black text-white p-6 rounded-3xl flex justify-between items-center shadow-2xl">
                    <div className="flex items-center gap-4">
                        <Calculator className="w-7 h-7 text-white/40" />
                        <span className="text-sm font-black uppercase tracking-widest">Total Count</span>
                    </div>
                    <span className="text-4xl font-black">{totalQty} <span className="text-sm opacity-50 uppercase">Pcs</span></span>
                </div>
            )}
        </div>

        {/* CHECKLIST */}
        <div className="bg-white rounded-[3rem] border-2 border-slate-100 overflow-hidden shadow-2xl">
            <div className="bg-black p-5 text-white text-[13px] font-black uppercase tracking-[0.2em] text-center">Condition Verification</div>
            <div className="divide-y-2 divide-slate-100">
                {CHECKLIST_ITEMS.map(key => {
                    const Icon = CHECKLIST_ICONS[key] || AlertCircle;
                    const isChecked = checklist[key].checked;
                    return (
                        <div key={key} className={`p-5 flex items-center justify-between transition-all ${isChecked ? 'bg-black/5' : ''}`}>
                            <div className="flex items-center gap-5">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all ${isChecked ? 'bg-black text-white' : 'bg-slate-100 text-slate-300'}`}>
                                    <Icon className="w-7 h-7" />
                                </div>
                                <span className={`text-[12px] font-black uppercase tracking-tight ${isChecked ? 'text-black' : 'text-slate-400'}`}>{key}</span>
                            </div>
                            <div className="flex items-center gap-5">
                                {isChecked && (
                                    <input type="number" min="0" value={checklist[key].count} onChange={e => handleChecklistChange(key, 'count', e.target.value)} onFocus={e => e.target.select()} className="w-24 h-14 bg-white border-4 border-black rounded-2xl text-center font-black text-2xl text-black outline-none shadow-xl" />
                                )}
                                <label className="relative inline-flex items-center cursor-pointer scale-125 ml-2">
                                    <input type="checkbox" checked={isChecked} onChange={e => handleChecklistChange(key, 'checked', e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                                </label>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* ACTIONS */}
        <div className="grid grid-cols-2 gap-5 pt-6">
            <Button variant="outline" className="w-full py-5" onClick={() => window.print()}><Share2 className="w-6 h-6" /> PRINT</Button>
            <Button variant="primary" className="w-full py-5" onClick={generatePDF}><Download className="w-6 h-6" /> PDF EXPORT</Button>
        </div>
      </div>

      <PrintLayout header={header} items={items} checklist={checklist} />
    </div>
  );
};

export default App;

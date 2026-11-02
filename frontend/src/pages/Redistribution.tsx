import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Search,
  Building2,
  Truck,
  AlertTriangle,
  ShieldCheck,
  PackageCheck,
  BarChart3,
  History,
  Database,
  ThermometerSnowflake,
  Sparkles,
  FileText,
  Navigation,
  Info,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import {
  useRedistributionDashboard,
  useInstitutionInventory,
  useAddInstitutionInventory,
  useCreateRedistributionRequest,
  useCancelRedistributionRequest,
  useRedistributionMatches,
  useCreateRedistributionProposal,
  useApproveRedistributionProposal,
  useRejectRedistributionProposal,
  useDispatchTransfer,
  useMarkTransferInTransit,
  useReceiveTransfer,
  useCompleteTransfer,
  useCancelTransfer,
  useRedistributionHistory,
  useRedistributionAnalytics,
  formatBloodGroup,
  formatComponentType,
  BloodGroupCode,
  BloodComponentCode,
  RedistributionUrgencyCode,
} from '../hooks/useRedistribution';

const BLOOD_GROUPS: BloodGroupCode[] = [
  'O_NEG',
  'O_POS',
  'A_NEG',
  'A_POS',
  'B_NEG',
  'B_POS',
  'AB_NEG',
  'AB_POS',
];

const COMPONENT_TYPES: BloodComponentCode[] = [
  'WHOLE_BLOOD',
  'PACKED_RBC',
  'PLASMA',
  'PLATELETS',
  'CRYOPRECIPITATE',
];

const URGENCY_BADGE_STYLES: Record<string, string> = {
  CRITICAL: 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse',
  URGENT: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  ROUTINE: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  REQUESTED: 'bg-slate-800 text-slate-300 border-slate-700',
  MATCHING: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  PROPOSED: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  AWAITING_APPROVAL: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  APPROVED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  RESERVED: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  READY_FOR_DISPATCH: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  DISPATCHED: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  IN_TRANSIT: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
  RECEIVED: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  REJECTED: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  CANCELLED: 'bg-slate-800 text-slate-400 border-slate-700',
  EXPIRED: 'bg-rose-950/40 text-rose-400 border-rose-800/40',
  FAILED: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
};

export const Redistribution: React.FC = () => {
  const { user } = useAuth();
  // Active tab navigation
  const [activeTab, setActiveTab] = useState<
    'requests' | 'incoming' | 'transfers' | 'inventory' | 'history' | 'analytics'
  >('requests');

  // Filter states
  const [search, setSearch] = useState('');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('');
  const [componentFilter, setComponentFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'urgency' | 'units'>('newest');
  const [page, setPage] = useState(1);

  // Dashboard query
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
    refetch: refetchDashboard,
  } = useRedistributionDashboard({
    bloodGroup: bloodGroupFilter || undefined,
    componentType: componentFilter || undefined,
    urgency: urgencyFilter || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
    page,
    limit: 15,
  });

  const { data: invData, isLoading: isInvLoading } = useInstitutionInventory();
  const { data: historyData, isLoading: isHistoryLoading } = useRedistributionHistory();
  const { data: analyticsData } = useRedistributionAnalytics();

  // Mutations
  const createRequestMutation = useCreateRedistributionRequest();
  const cancelRequestMutation = useCancelRedistributionRequest();
  const addInventoryMutation = useAddInstitutionInventory();
  const createProposalMutation = useCreateRedistributionProposal();
  const approveProposalMutation = useApproveRedistributionProposal();
  const rejectProposalMutation = useRejectRedistributionProposal();
  const dispatchMutation = useDispatchTransfer();
  const inTransitMutation = useMarkTransferInTransit();
  const receiveMutation = useReceiveTransfer();
  const completeMutation = useCompleteTransfer();
  const cancelMutation = useCancelTransfer();

  // Selected request for source discovery modal
  const [selectedMatchRequestId, setSelectedMatchRequestId] = useState<string | null>(null);
  const { data: matchData, isLoading: isMatchesLoading } = useRedistributionMatches(selectedMatchRequestId);

  // Create Redistribution Request Modal State
  const [isCreateReqOpen, setIsCreateReqOpen] = useState(false);
  const [reqBloodGroup, setReqBloodGroup] = useState<BloodGroupCode>('O_NEG');
  const [reqComponent, setReqComponent] = useState<BloodComponentCode>('PACKED_RBC');
  const [reqUnits, setReqUnits] = useState(4);
  const [reqUrgency, setReqUrgency] = useState<RedistributionUrgencyCode>('URGENT');
  const [reqRequiredBy, setReqRequiredBy] = useState(
    new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [reqMinShelfDays, setReqMinShelfDays] = useState(5);
  const [reqReason, setReqReason] = useState('');
  const [reqHandlingNotes, setReqHandlingNotes] = useState('');

  // Add Facility Inventory Modal State
  const [isAddInvOpen, setIsAddInvOpen] = useState(false);
  const [invBloodGroup, setInvBloodGroup] = useState<BloodGroupCode>('O_NEG');
  const [invComponent, setInvComponent] = useState<BloodComponentCode>('PACKED_RBC');
  const [invUnits, setInvUnits] = useState(8);
  const [invExpiryDate, setInvExpiryDate] = useState(
    new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [invBatchNumber, setInvBatchNumber] = useState('');

  // Proposal Modal State
  const [proposalTargetReq, setProposalTargetReq] = useState<any | null>(null);
  const [proposalSourceCandidate, setProposalSourceCandidate] = useState<any | null>(null);
  const [proposalUnits, setProposalUnits] = useState(2);
  const [proposalNotes, setProposalNotes] = useState('');

  // Dispatch Modal State
  const [dispatchTarget, setDispatchTarget] = useState<any | null>(null);
  const [dispatcherName, setDispatcherName] = useState('');
  const [shipmentRef, setShipmentRef] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('Validated Cold-Chain Medical Courier');
  const [tempConfirmed, setTempConfirmed] = useState(false);
  const [coldChainNotes, setColdChainNotes] = useState('');

  // In-Transit Modal State
  const [transitTarget, setTransitTarget] = useState<any | null>(null);
  const [transitNotes, setTransitNotes] = useState('');

  // Receive & Reconcile Modal State
  const [receiveTarget, setReceiveTarget] = useState<any | null>(null);
  const [unitsReceived, setUnitsReceived] = useState(1);
  const [damagedUnits, setDamagedUnits] = useState(0);
  const [receiverStaffName, setReceiverStaffName] = useState('');
  const [conditionVerified, setConditionVerified] = useState(true);
  const [discrepancyReason, setDiscrepancyReason] = useState('');

  // Cancel Modal State
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelRequestTarget, setCancelRequestTarget] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Complete Discrepancy Transfer Modal State
  const [completeTarget, setCompleteTarget] = useState<any | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const summary = dashboardData?.summary || {
    activeRedistributionRequests: 0,
    incomingTransferRequests: 0,
    outgoingTransferRequests: 0,
    unitsAwaitingDispatch: 0,
    unitsCurrentlyInTransit: 0,
    unitsReceivedInPeriod: 0,
    urgentAndCriticalRequests: 0,
    completedTransfers: 0,
  };

  const institution = dashboardData?.institution;
  const requestsList = useMemo(() => {
    const raw = dashboardData?.requests || [];
    return [...raw].sort((a: any, b: any) => {
      if (sortBy === 'units') return b.unitsRequired - a.unitsRequired;
      if (sortBy === 'urgency') {
        const rank: Record<string, number> = { CRITICAL: 3, URGENT: 2, ROUTINE: 1 };
        return (rank[b.urgency] || 0) - (rank[a.urgency] || 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [dashboardData?.requests, sortBy]);

  const incomingOpportunities = dashboardData?.incomingOpportunities || [];
  const proposalsList = dashboardData?.proposals || [];
  const transfersList = dashboardData?.transfers || [];
  const institutionInventory = invData?.items || [];

  const handleCreateRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createRequestMutation.mutateAsync({
        bloodGroup: reqBloodGroup,
        componentType: reqComponent,
        unitsRequired: Number(reqUnits),
        urgency: reqUrgency,
        requiredBy: new Date(reqRequiredBy).toISOString(),
        minRemainingShelfLifeDays: Number(reqMinShelfDays),
        reason: reqReason,
        specialHandlingNotes: reqHandlingNotes || undefined,
      });
      setIsCreateReqOpen(false);
      setReqReason('');
      setReqHandlingNotes('');
      if (created?.id) {
        setSelectedMatchRequestId(created.id);
      }
    } catch {
      // handled by mutation hook
    }
  };

  const handleAddInventorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addInventoryMutation.mutateAsync({
        bloodGroup: invBloodGroup,
        componentType: invComponent,
        unitsCount: Number(invUnits),
        expiryDate: new Date(invExpiryDate).toISOString(),
        batchNumber: invBatchNumber || undefined,
      });
      setIsAddInvOpen(false);
      setInvBatchNumber('');
    } catch {
      // handled by mutation hook
    }
  };

  const handleCreateProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalTargetReq) return;
    try {
      await createProposalMutation.mutateAsync({
        requestId: proposalTargetReq.id,
        sourceFacilityType: proposalSourceCandidate?.facilityType,
        sourceHospitalId:
          proposalSourceCandidate?.facilityType === 'HOSPITAL'
            ? proposalSourceCandidate.institutionId
            : undefined,
        sourceBloodBankId:
          proposalSourceCandidate?.facilityType === 'BLOOD_BANK'
            ? proposalSourceCandidate.institutionId
            : undefined,
        bloodGroup: proposalSourceCandidate?.matchedBloodGroups?.[0] || proposalTargetReq.bloodGroup,
        unitsProposed: Number(proposalUnits),
        notes: proposalNotes || undefined,
      });
      setProposalTargetReq(null);
      setProposalSourceCandidate(null);
      setProposalNotes('');
    } catch {
      // handled by mutation hook
    }
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchTarget) return;
    try {
      await dispatchMutation.mutateAsync({
        transferId: dispatchTarget.id,
        shipmentReference: shipmentRef || undefined,
        dispatcherName,
        transportVehicleDetails: vehicleDetails,
        temperatureCheckConfirmed: tempConfirmed,
        coldChainNotes: coldChainNotes || undefined,
      });
      setDispatchTarget(null);
      setDispatcherName('');
      setShipmentRef('');
      setTempConfirmed(false);
      setColdChainNotes('');
    } catch {
      // handled by mutation hook
    }
  };

  const handleInTransitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transitTarget) return;
    try {
      await inTransitMutation.mutateAsync({
        transferId: transitTarget.id,
        inTransitNotes: transitNotes,
      });
      setTransitTarget(null);
      setTransitNotes('');
    } catch {
      // handled by mutation hook
    }
  };

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveTarget) return;
    try {
      await receiveMutation.mutateAsync({
        transferId: receiveTarget.id,
        unitsReceived: Number(unitsReceived),
        damagedUnits: Number(damagedUnits),
        receiverStaffName,
        conditionVerified,
        discrepancyReason: discrepancyReason || undefined,
      });
      setReceiveTarget(null);
      setReceiverStaffName('');
      setDiscrepancyReason('');
      setDamagedUnits(0);
    } catch {
      // handled by mutation hook
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    try {
      await cancelMutation.mutateAsync({
        transferId: cancelTarget.id,
        reason: cancelReason,
      });
      setCancelTarget(null);
      setCancelReason('');
    } catch {
      // handled by mutation hook
    }
  };

  const handleCancelRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelRequestTarget) return;
    try {
      await cancelRequestMutation.mutateAsync({
        requestId: cancelRequestTarget.id,
        reason: cancelReason,
      });
      setCancelRequestTarget(null);
      setCancelReason('');
    } catch {
      // handled by mutation hook
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeTarget) return;
    try {
      await completeMutation.mutateAsync({
        transferId: completeTarget.id,
        resolutionNotes,
      });
      setCompleteTarget(null);
      setResolutionNotes('');
    } catch {
      // handled by mutation hook
    }
  };

  return (
    <div className="space-y-8 text-slate-100 pb-14">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 shrink-0">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-white font-display">
                Inter-Facility Blood Redistribution
              </h2>
              {institution && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> {institution.name} ({institution.facilityType})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Hospital-to-Hospital & Blood Bank stock balancing, FEFO wastage prevention, atomic unit reservation, and cold-chain shipment reconciliation
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsAddInvOpen(true)}
            className="flex items-center gap-2 border-slate-700 text-slate-200 hover:bg-slate-800/60"
          >
            <Database className="w-4 h-4 text-sky-400" />
            Register Facility Stock
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsCreateReqOpen(true)}
            className="flex items-center gap-2 shadow-lg shadow-rose-600/30"
          >
            <Plus className="w-4 h-4" />
            New Redistribution Request
          </Button>
        </div>
      </div>

      {/* Clinical & Regulatory Safety Banner */}
      <div className="p-3.5 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 flex items-start gap-3 text-xs text-indigo-200">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-indigo-300">Clinical & Regulatory Notice: </span>
          Software compatibility discovery coordinates institutional inventory logistics only. Final clinical transfusion release remains subject to mandatory pre-transfusion serological cross-matching, cold-chain verification, and authorized Blood Bank Medical Officer approval.
        </div>
      </div>

      {/* 8 Summary Cards (Module A) */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          {
            label: 'Active Requests',
            value: summary.activeRedistributionRequests,
            sub: 'Open outgoing',
            color: 'text-rose-400',
          },
          {
            label: 'Incoming Opportunities',
            value: summary.incomingTransferRequests,
            sub: 'Partner requests',
            color: 'text-amber-400',
          },
          {
            label: 'Outgoing Requests',
            value: summary.outgoingTransferRequests,
            sub: 'Total raised',
            color: 'text-sky-400',
          },
          {
            label: 'Awaiting Dispatch',
            value: summary.unitsAwaitingDispatch,
            sub: 'Reserved units',
            color: 'text-cyan-400',
          },
          {
            label: 'Units In Transit',
            value: summary.unitsCurrentlyInTransit,
            sub: 'Active couriers',
            color: 'text-purple-400',
          },
          {
            label: 'Units Received',
            value: summary.unitsReceivedInPeriod,
            sub: 'Reconciled stock',
            color: 'text-emerald-400',
          },
          {
            label: 'Urgent / Critical',
            value: summary.urgentAndCriticalRequests,
            sub: 'Priority cases',
            color: 'text-rose-500',
          },
          {
            label: 'Completed Transfers',
            value: summary.completedTransfers,
            sub: 'Full lifecycle',
            color: 'text-teal-400',
          },
        ].map((card, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-xl flex flex-col justify-between"
          >
            <span className="text-[11px] font-semibold text-slate-400 leading-tight">{card.label}</span>
            <div className={`text-2xl font-bold font-display my-1 ${card.color}`}>
              {isDashboardLoading ? '—' : card.value}
            </div>
            <span className="text-[10px] text-slate-500">{card.sub}</span>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'requests', label: 'Requests & Source Discovery', icon: Sparkles, count: requestsList.length },
          {
            id: 'incoming',
            label: 'Incoming & Proposals',
            icon: Building2,
            count: incomingOpportunities.length + proposalsList.filter((p: any) => p.status === 'PENDING').length,
          },
          { id: 'transfers', label: 'Shipments, Dispatch & Map', icon: Truck, count: transfersList.length },
          { id: 'inventory', label: 'Facility Stock', icon: Database, count: institutionInventory.length },
          { id: 'history', label: 'History & Audit Log', icon: History },
          { id: 'analytics', label: 'Analytics & SLA', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${active
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/25'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-800'
                }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Error State */}
      {isDashboardError && (
        <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-center space-y-3">
          <p className="text-sm font-semibold text-rose-300">
            Unable to load redistribution records. Please verify your connection or facility authorization.
          </p>
          <Button variant="outline" onClick={() => refetchDashboard()}>
            Retry Loading
          </Button>
        </div>
      )}

      {/* TAB 1: REDISTRIBUTION REQUESTS & SOURCE MATCHING */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Search & Filter Controls */}
          <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/30 flex flex-wrap gap-3 items-center justify-between">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID, hospital name, blood group, reason..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/40"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={bloodGroupFilter}
                onChange={(e) => setBloodGroupFilter(e.target.value)}
                aria-label="Filter by Blood Group"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              >
                <option value="">All Blood Groups</option>
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {formatBloodGroup(bg)}
                  </option>
                ))}
              </select>

              <select
                value={componentFilter}
                onChange={(e) => setComponentFilter(e.target.value)}
                aria-label="Filter by Component"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              >
                <option value="">All Components</option>
                {COMPONENT_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {formatComponentType(c)}
                  </option>
                ))}
              </select>

              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                aria-label="Filter by Urgency"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              >
                <option value="">All Urgencies</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="URGENT">URGENT</option>
                <option value="ROUTINE">ROUTINE</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by Status"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              >
                <option value="">All Statuses</option>
                {[
                  'MATCHING',
                  'AWAITING_APPROVAL',
                  'RESERVED',
                  'DISPATCHED',
                  'IN_TRANSIT',
                  'RECEIVED',
                  'COMPLETED',
                  'CANCELLED',
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Sort requests"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              >
                <option value="newest">Sort: Newest First</option>
                <option value="urgency">Sort: Highest Urgency</option>
                <option value="units">Sort: Most Units</option>
              </select>
            </div>
          </div>

          {/* Requests Table */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/20 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950/40">
                  <th className="py-3.5 px-4">Request ID</th>
                  <th className="py-3.5 px-4">Destination Facility</th>
                  <th className="py-3.5 px-4">Group & Component</th>
                  <th className="py-3.5 px-4">Units</th>
                  <th className="py-3.5 px-4">Urgency</th>
                  <th className="py-3.5 px-4">Required By</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {requestsList.map((req: any) => (
                  <tr key={req.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      #{req.id.slice(0, 8)}
                      <div className="text-[10px] text-slate-500">
                        {new Date(req.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{req.destinationName}</div>
                      <div className="text-[10px] text-slate-400">
                        {req.destinationCity} • {req.reason}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 font-bold mr-1.5">
                        {formatBloodGroup(req.bloodGroup)}
                      </span>
                      <span className="text-slate-300 font-medium">
                        {formatComponentType(req.componentType)}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Min shelf life: {req.minRemainingShelfLifeDays}d
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">{req.unitsRequired} bags</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${URGENCY_BADGE_STYLES[req.urgency] || URGENCY_BADGE_STYLES.ROUTINE
                          }`}
                      >
                        {req.urgency}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {new Date(req.requiredBy).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_BADGE_STYLES[req.status] || STATUS_BADGE_STYLES.REQUESTED
                          }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {(req.isOwnRequest || institution?.role === 'ADMIN') && (
                        <Button
                          variant="outline"
                          onClick={() => setSelectedMatchRequestId(req.id)}
                          className="text-[11px] py-1.5 px-3 border-indigo-500/40 text-indigo-300 hover:bg-indigo-950/30"
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1 inline" />
                          Discover Sources
                        </Button>
                      )}
                      {(req.isOwnRequest || institution?.role === 'ADMIN') &&
                        [
                          'REQUESTED',
                          'MATCHING',
                          'PROPOSED',
                          'AWAITING_APPROVAL',
                          'APPROVED',
                          'RESERVED',
                        ].includes(req.status) && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setCancelRequestTarget(req);
                              setCancelReason('');
                            }}
                            className="text-[11px] py-1.5 px-3 border-rose-500/30 text-rose-400"
                          >
                            Cancel Request
                          </Button>
                        )}
                      {!req.isOwnRequest &&
                        ['REQUESTED', 'MATCHING', 'PROPOSED', 'AWAITING_APPROVAL'].includes(req.status) && (
                          <Button
                            variant="primary"
                            onClick={() => {
                              setProposalTargetReq(req);
                              setProposalSourceCandidate(null);
                              setProposalUnits(req.unitsRequired);
                            }}
                            className="text-[11px] py-1.5 px-3"
                          >
                            Offer Stock
                          </Button>
                        )}
                    </td>
                  </tr>
                ))}

                {!isDashboardLoading && requestsList.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No redistribution requests match the selected filters. Click "New Redistribution Request" to initiate inter-hospital coordination.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {dashboardData?.pagination && dashboardData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                Page {dashboardData.pagination.page} of {dashboardData.pagination.totalPages} (
                {dashboardData.pagination.total} total records)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={page >= dashboardData.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INCOMING OPPORTUNITIES & PROPOSALS */}
      {activeTab === 'incoming' && (
        <div className="space-y-8">
          {/* Pending Proposals Awaiting Approval */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              Transfer Proposals ({proposalsList.length})
            </h3>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/20 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950/40">
                    <th className="py-3 px-4">Proposal ID</th>
                    <th className="py-3 px-4">Source Facility</th>
                    <th className="py-3 px-4">Destination Facility</th>
                    <th className="py-3 px-4">Blood / Component</th>
                    <th className="py-3 px-4">Units</th>
                    <th className="py-3 px-4">Approx. Distance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {proposalsList.map((prop: any) => {
                    const sourceName =
                      prop.sourceHospital?.name || prop.sourceBloodBank?.name || 'Source Facility';
                    const destName =
                      prop.request?.destinationHospital?.name ||
                      prop.request?.destinationBloodBank?.name ||
                      'Destination Facility';
                    return (
                      <tr key={prop.id} className="hover:bg-slate-800/20">
                        <td className="py-3 px-4 font-mono text-slate-300">#{prop.id.slice(0, 8)}</td>
                        <td className="py-3 px-4 font-semibold text-white">{sourceName}</td>
                        <td className="py-3 px-4 text-slate-300">{destName}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-rose-400 mr-1.5">
                            {formatBloodGroup(prop.bloodGroup)}
                          </span>
                          <span className="text-slate-300">{formatComponentType(prop.componentType)}</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-white">{prop.unitsProposed} u</td>
                        <td className="py-3 px-4 text-slate-400">
                          {prop.estimatedDistanceKm !== null
                            ? `~${prop.estimatedDistanceKm} km (~${prop.estimatedTransitMins}m)`
                            : 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${prop.status === 'APPROVED'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : prop.status === 'REJECTED'
                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              }`}
                          >
                            {prop.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {prop.status === 'PENDING' &&
                            (prop.proposedByUserId === user?.id && institution?.role !== 'ADMIN' ? (
                              <span className="text-[10px] font-semibold text-slate-400 italic">
                                Awaiting Counterparty Approval
                              </span>
                            ) : (
                              <>
                                <Button
                                  variant="primary"
                                  isLoading={approveProposalMutation.isPending}
                                  onClick={() =>
                                    approveProposalMutation.mutate({
                                      proposalId: prop.id,
                                      notes: 'Approved via Redistribution Dashboard',
                                    })
                                  }
                                  className="text-[11px] py-1 px-3"
                                >
                                  Approve & Reserve Units
                                </Button>
                                <Button
                                  variant="outline"
                                  isLoading={rejectProposalMutation.isPending}
                                  onClick={() =>
                                    rejectProposalMutation.mutate({
                                      proposalId: prop.id,
                                      reason: 'Declined by reviewing coordinator',
                                    })
                                  }
                                  className="text-[11px] py-1 px-3 border-rose-500/30 text-rose-300"
                                >
                                  Reject
                                </Button>
                              </>
                            ))}
                        </td>
                      </tr>
                    );
                  })}
                  {proposalsList.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No transfer proposals submitted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Incoming Partner Requests */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-400" />
              Partner Hospital Requests Open for Fulfillment ({incomingOpportunities.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {incomingOpportunities.map((req: any) => (
                <div
                  key={req.id}
                  className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{req.destinationName}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${URGENCY_BADGE_STYLES[req.urgency] || URGENCY_BADGE_STYLES.ROUTINE
                            }`}
                        >
                          {req.urgency}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{req.reason}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-rose-400">
                        {req.unitsRequired}u {formatBloodGroup(req.bloodGroup)}
                      </span>
                      <div className="text-[10px] text-slate-400">
                        {formatComponentType(req.componentType)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/60">
                    <span>
                      Approx. {req.distanceKm} km (~{req.estimatedTransitMins} mins courier)
                    </span>
                    <Button
                      variant="primary"
                      onClick={() => {
                        setProposalTargetReq(req);
                        setProposalSourceCandidate(null);
                        setProposalUnits(req.unitsRequired);
                      }}
                      className="text-xs py-1.5 px-3"
                    >
                      Propose Stock Transfer
                    </Button>
                  </div>
                </div>
              ))}
              {incomingOpportunities.length === 0 && (
                <div className="col-span-2 p-8 rounded-2xl border border-slate-800/60 text-center text-xs text-slate-500">
                  No open partner requests from other institutions currently awaiting fulfillment.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVE SHIPMENTS, DISPATCH, RECEIPT & MAP VISUALIZATION (Modules G & I) */}
      {activeTab === 'transfers' && (
        <div className="space-y-6">
          {/* Interactive Synchronized Institutional Route Map (Module I) */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">
                  Institutional Redistribution Route & Shipment Map
                </h3>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Institution-Level Coordinates Only • Manually Updated Transit Status
              </span>
            </div>

            <div className="relative h-64 w-full rounded-xl bg-slate-950 border border-slate-800/80 overflow-hidden flex items-center justify-center">
              {/* Coordinate grid background */}
              <svg className="w-full h-full" viewBox="0 0 800 240">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path
                      d="M 40 0 L 0 0 0 40"
                      fill="none"
                      stroke="rgba(148,163,184,0.08)"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="800" height="240" fill="url(#grid)" />

                {transfersList.slice(0, 5).map((t: any, idx: number) => {
                  const yPos = 45 + idx * 40;
                  const srcName = t.sourceHospital?.name || t.sourceBloodBank?.name || 'Source';
                  const dstName = t.destinationHospital?.name || t.destinationBloodBank?.name || 'Destination';
                  const isMoving = t.status === 'DISPATCHED' || t.status === 'IN_TRANSIT';
                  const isDone = t.status === 'RECEIVED' || t.status === 'COMPLETED';
                  const midX = isDone ? 620 : isMoving ? 400 : 180;

                  return (
                    <g key={t.id}>
                      {/* Route Line */}
                      <line
                        x1={160}
                        y1={yPos}
                        x2={640}
                        y2={yPos}
                        stroke={isDone ? '#10b981' : isMoving ? '#ec4899' : '#475569'}
                        strokeWidth="2.5"
                        strokeDasharray={isDone ? 'none' : '6,6'}
                      />
                      {/* Source Node */}
                      <circle cx={160} cy={yPos} r={7} fill="#38bdf8" />
                      <text x={20} y={yPos + 4} fill="#cbd5e1" fontSize="11" fontWeight="bold">
                        {srcName.slice(0, 18)}
                      </text>
                      {/* Shipment Indicator */}
                      <circle
                        cx={midX}
                        cy={yPos}
                        r={8}
                        fill={isDone ? '#10b981' : isMoving ? '#f43f5e' : '#f59e0b'}
                      />
                      <text x={midX - 45} y={yPos - 12} fill="#f8fafc" fontSize="10" fontWeight="bold">
                        {t.unitsApproved}u {formatBloodGroup(t.bloodGroup)} ({t.status})
                      </text>
                      {/* Destination Node */}
                      <circle cx={640} cy={yPos} r={7} fill="#10b981" />
                      <text x={655} y={yPos + 4} fill="#cbd5e1" fontSize="11" fontWeight="bold">
                        {dstName.slice(0, 18)}
                      </text>
                    </g>
                  );
                })}

                {transfersList.length === 0 && (
                  <text x="400" y="120" textAnchor="middle" fill="#64748b" fontSize="13">
                    No active institutional transfers to plot. Approve a proposal to visualize routes.
                  </text>
                )}
              </svg>
            </div>
          </div>

          {/* Active & Historical Transfers Table */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/20 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950/40">
                  <th className="py-3.5 px-4">Transfer / Shipment Ref</th>
                  <th className="py-3.5 px-4">Source → Destination</th>
                  <th className="py-3.5 px-4">Blood / Component</th>
                  <th className="py-3.5 px-4">Units (App / Disp / Rec)</th>
                  <th className="py-3.5 px-4">Cold-Chain & Status</th>
                  <th className="py-3.5 px-4 text-right">Operational Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {transfersList.map((t: any) => {
                  const srcName = t.sourceHospital?.name || t.sourceBloodBank?.name || 'Source';
                  const dstName = t.destinationHospital?.name || t.destinationBloodBank?.name || 'Destination';
                  const isSource =
                    institution?.role === 'ADMIN' ||
                    (institution?.hospitalId && t.sourceHospitalId === institution.hospitalId) ||
                    (institution?.bloodBankId && t.sourceBloodBankId === institution.bloodBankId);
                  const isDest =
                    institution?.role === 'ADMIN' ||
                    (institution?.hospitalId && t.destinationHospitalId === institution.hospitalId) ||
                    (institution?.bloodBankId && t.destinationBloodBankId === institution.bloodBankId);

                  return (
                    <tr key={t.id} className="hover:bg-slate-800/20">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-white">
                          {t.shipmentReference || `#${t.id.slice(0, 8)}`}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Created: {new Date(t.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-sky-300">{srcName}</div>
                        <div className="text-[10px] text-slate-400">↓ to {dstName}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-rose-400 mr-1.5">
                          {formatBloodGroup(t.bloodGroup)}
                        </span>
                        <span className="text-slate-300">{formatComponentType(t.componentType)}</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {t.unitsApproved} / {t.unitsDispatched ?? '—'} / {t.unitsReceived ?? '—'}
                        {t.hasDiscrepancy && (
                          <div className="text-[10px] text-rose-400 font-bold flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3 h-3" /> Discrepancy: {t.discrepancyReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 space-y-1">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE_STYLES[t.status] || STATUS_BADGE_STYLES.RESERVED
                            }`}
                        >
                          {t.status}
                        </span>
                        {t.temperatureCheckConfirmed && (
                          <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                            <ThermometerSnowflake className="w-3 h-3" /> Cold-Chain Verified
                          </div>
                        )}
                        {t.inTransitNotes && (
                          <div className="text-[10px] text-slate-400 italic">{t.inTransitNotes}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {isSource && ['APPROVED', 'RESERVED', 'READY_FOR_DISPATCH'].includes(t.status) && (
                          <Button
                            variant="primary"
                            onClick={() => {
                              setDispatchTarget(t);
                              setTempConfirmed(false);
                            }}
                            className="text-[11px] py-1 px-3"
                          >
                            <Truck className="w-3.5 h-3.5 mr-1 inline" />
                            Record Dispatch
                          </Button>
                        )}

                        {(isSource || isDest) && ['DISPATCHED', 'IN_TRANSIT'].includes(t.status) && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setTransitTarget(t);
                              setTransitNotes(t.inTransitNotes || '');
                            }}
                            className="text-[11px] py-1 px-2.5"
                          >
                            Update Transit
                          </Button>
                        )}

                        {isDest && ['DISPATCHED', 'IN_TRANSIT'].includes(t.status) && (
                          <Button
                            variant="primary"
                            onClick={() => {
                              setReceiveTarget(t);
                              setUnitsReceived(t.unitsDispatched ?? t.unitsApproved);
                              setDamagedUnits(0);
                              setConditionVerified(true);
                            }}
                            className="text-[11px] py-1 px-3 bg-emerald-600 hover:bg-emerald-500"
                          >
                            <PackageCheck className="w-3.5 h-3.5 mr-1 inline" />
                            Confirm Receipt
                          </Button>
                        )}

                        {isDest && t.status === 'RECEIVED' && (
                          <Button
                            variant="outline"
                            onClick={() => setCompleteTarget(t)}
                            className="text-[11px] py-1 px-3 border-emerald-500/40 text-emerald-300"
                          >
                            Resolve & Complete
                          </Button>
                        )}

                        {(isSource || isDest) &&
                          ['APPROVED', 'RESERVED', 'READY_FOR_DISPATCH'].includes(t.status) && (
                            <Button
                              variant="outline"
                              onClick={() => setCancelTarget(t)}
                              className="text-[11px] py-1 px-2.5 border-rose-500/30 text-rose-400"
                            >
                              Cancel
                            </Button>
                          )}
                      </td>
                    </tr>
                  );
                })}
                {transfersList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No active or completed transfers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: INSTITUTIONAL INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              Authorized Facility Blood & Component Inventory ({institutionInventory.length} Batches)
            </h3>
            <Button variant="primary" onClick={() => setIsAddInvOpen(true)} className="text-xs">
              <Plus className="w-4 h-4 mr-1 inline" /> Register Stock Batch
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/20 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950/40">
                  <th className="py-3 px-4">Lot / Batch #</th>
                  <th className="py-3 px-4">Facility</th>
                  <th className="py-3 px-4">Blood Group</th>
                  <th className="py-3 px-4">Component Type</th>
                  <th className="py-3 px-4">Units</th>
                  <th className="py-3 px-4">Storage Temp</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {institutionInventory.map((item: any) => {
                  const daysLeft = Math.floor(
                    (new Date(item.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
                  );
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/20">
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {item.batchNumber || `#${item.id.slice(0, 8)}`}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {item.hospital?.name || item.bloodBank?.name || institution?.name}
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-400">
                        {formatBloodGroup(item.bloodGroup)}
                      </td>
                      <td className="py-3 px-4 text-slate-200">
                        {formatComponentType(item.componentType)}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">{item.unitsCount} bags</td>
                      <td className="py-3 px-4 text-slate-400">{item.storageTemp || '2°C to 6°C'}</td>
                      <td className="py-3 px-4 text-slate-300">
                        {new Date(item.expiryDate).toLocaleDateString()}{' '}
                        <span
                          className={`text-[10px] font-bold ${daysLeft <= 7 ? 'text-amber-400' : 'text-slate-500'
                            }`}
                        >
                          ({daysLeft}d left)
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.status === 'AVAILABLE'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : item.status === 'RESERVED'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!isInvLoading && institutionInventory.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      No inventory batches registered for your facility yet. Click "Register Stock Batch" to add available units.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: TRANSFER HISTORY & IMMUTABLE AUDIT TRAIL (Module 19) */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            Immutable Redistribution Audit Trail ({historyData?.auditEvents?.length || 0} Events)
          </h3>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/20 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950/40">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Authorized Institution & Role</th>
                  <th className="py-3 px-4">State Transition</th>
                  <th className="py-3 px-4">Operational Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {(historyData?.auditEvents || []).map((ev: any) => (
                  <tr key={ev.id} className="hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(ev.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-rose-400">{ev.action}</td>
                    <td className="py-3 px-4 text-slate-200">
                      {ev.actorInstitutionName || 'System'}{' '}
                      <span className="text-[10px] text-slate-500">({ev.actorRole})</span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {ev.previousState ? `${ev.previousState} → ` : ''}
                      <span className="font-bold text-emerald-400">{ev.newState || '—'}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{ev.reason || '—'}</td>
                  </tr>
                ))}
                {!isHistoryLoading && (!historyData?.auditEvents || historyData.auditEvents.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      No redistribution audit events recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: REDISTRIBUTION ANALYTICS & REPORTING (Module J) */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40">
              <span className="text-xs text-slate-400">Total Units Received</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {analyticsData?.metrics?.totalUnitsReceived ?? 0}
              </div>
              <span className="text-[10px] text-slate-500">Credited after reconciliation</span>
            </div>
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40">
              <span className="text-xs text-slate-400">Total Units Supplied</span>
              <div className="text-2xl font-bold text-sky-400 mt-1">
                {analyticsData?.metrics?.totalUnitsSupplied ?? 0}
              </div>
              <span className="text-[10px] text-slate-500">Dispatched to partner centers</span>
            </div>
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40">
              <span className="text-xs text-slate-400">Avg Request-to-Approval</span>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                {analyticsData?.metrics?.avgRequestToApprovalMins !== null &&
                  analyticsData?.metrics?.avgRequestToApprovalMins !== undefined
                  ? `${analyticsData.metrics.avgRequestToApprovalMins} mins`
                  : 'N/A'}
              </div>
              <span className="text-[10px] text-slate-500">Measured from actual timestamps</span>
            </div>
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40">
              <span className="text-xs text-slate-400">Avg Dispatch-to-Receipt</span>
              <div className="text-2xl font-bold text-purple-400 mt-1">
                {analyticsData?.metrics?.avgDispatchToReceiptMins !== null &&
                  analyticsData?.metrics?.avgDispatchToReceiptMins !== undefined
                  ? `${analyticsData.metrics.avgDispatchToReceiptMins} mins`
                  : 'N/A'}
              </div>
              <span className="text-[10px] text-slate-500">Measured courier transit duration</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/30 space-y-3">
              <h4 className="text-sm font-bold text-white">Transfers by Blood Group</h4>
              <div className="space-y-2">
                {Object.entries(analyticsData?.byBloodGroup || {}).map(([bg, stats]: [string, any]) => (
                  <div key={bg} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/60">
                    <span className="font-bold text-rose-400">{formatBloodGroup(bg)}</span>
                    <span className="text-slate-300">
                      {stats.transfers} transfers ({stats.units} units)
                    </span>
                  </div>
                ))}
                {Object.keys(analyticsData?.byBloodGroup || {}).length === 0 && (
                  <p className="text-xs text-slate-500">No transfer data recorded yet.</p>
                )}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/30 space-y-3">
              <h4 className="text-sm font-bold text-white">Transfers by Component & Quality</h4>
              <div className="space-y-2 text-xs">
                {Object.entries(analyticsData?.byComponent || {}).map(([comp, stats]: [string, any]) => (
                  <div key={comp} className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                    <span className="font-semibold text-slate-200">{formatComponentType(comp)}</span>
                    <span className="text-slate-300">
                      {stats.transfers} transfers ({stats.units} units)
                    </span>
                  </div>
                ))}
                <div className="pt-2 flex items-center justify-between text-slate-400">
                  <span>Recorded Discrepancies:</span>
                  <span className="font-bold text-rose-400">
                    {analyticsData?.metrics?.recordedDiscrepancies ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Completed Within Requested Deadline:</span>
                  <span className="font-bold text-emerald-400">
                    {analyticsData?.metrics?.completedWithinDeadline ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE REDISTRIBUTION REQUEST (Module B) */}
      <Modal
        isOpen={isCreateReqOpen}
        onClose={() => setIsCreateReqOpen(false)}
        title="Create Inter-Facility Blood Redistribution Request"
      >
        <form onSubmit={handleCreateRequestSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Blood Group *</label>
              <select
                value={reqBloodGroup}
                onChange={(e) => setReqBloodGroup(e.target.value as BloodGroupCode)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
              >
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {formatBloodGroup(bg)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1">Blood Component *</label>
              <select
                value={reqComponent}
                onChange={(e) => setReqComponent(e.target.value as BloodComponentCode)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
              >
                {COMPONENT_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {formatComponentType(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Units Required *</label>
              <input
                type="number"
                min={1}
                max={50}
                required
                value={reqUnits}
                onChange={(e) => setReqUnits(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1">Urgency Level *</label>
              <select
                value={reqUrgency}
                onChange={(e) => setReqUrgency(e.target.value as RedistributionUrgencyCode)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              >
                <option value="ROUTINE">ROUTINE (Max 50u)</option>
                <option value="URGENT">URGENT (Max 30u)</option>
                <option value="CRITICAL">CRITICAL (Max 20u)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1">Min Shelf Life (Days)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={reqMinShelfDays}
                onChange={(e) => setReqMinShelfDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Required-By Date & Time *</label>
            <input
              type="datetime-local"
              required
              value={reqRequiredBy}
              onChange={(e) => setReqRequiredBy(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Reason for Request *</label>
            <input
              type="text"
              required
              placeholder="e.g., Trauma surgery shortage / Scheduled oncology transfusions"
              value={reqReason}
              onChange={(e) => setReqReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Delivery Destination / Special Handling Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Gate 2 Transfusion Medicine Receiving Dock; maintain 2°C–6°C"
              value={reqHandlingNotes}
              onChange={(e) => setReqHandlingNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="outline" onClick={() => setIsCreateReqOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={createRequestMutation.isPending}>
              Create Request & Discover Sources
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: INTELLIGENT SOURCE HOSPITAL DISCOVERY (Modules C & D) */}
      <Modal
        isOpen={!!selectedMatchRequestId}
        onClose={() => setSelectedMatchRequestId(null)}
        title="Intelligent Source Institution Discovery & Prioritization"
      >
        <div className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
          {isMatchesLoading && (
            <div className="py-8 text-center text-slate-400">
              Scanning verified hospitals and blood banks for compatible stock, shelf life, and courier distance...
            </div>
          )}

          {matchData && (
            <>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-rose-400 text-sm">
                    {matchData.unitsRequired}u {formatBloodGroup(matchData.requestedBloodGroup)}{' '}
                    {formatComponentType(matchData.componentType)}
                  </span>
                  <div className="text-[10px] text-slate-400">
                    Required Cold-Chain: {matchData.storagePolicy?.storageTempRange} • Min Shelf Life:{' '}
                    {matchData.minRemainingShelfLifeDays} days
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-[10px] font-bold">
                  FEFO + Proximity Ranked
                </span>
              </div>

              {/* Multi-Source Plan Notice if applicable */}
              {matchData.multiSourcePlan && (
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/20 space-y-2">
                  <div className="font-bold text-amber-300">
                    Multi-Source Split Fulfillment Recommended ({matchData.multiSourcePlan.totalUnitsCovered}u covered across {matchData.multiSourcePlan.sources.length} facilities)
                  </div>
                  <p className="text-[11px] text-slate-300">{matchData.multiSourcePlan.operationalNote}</p>
                </div>
              )}

              {/* Eligible Matches */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
                  1. Eligible Verified Source Matches ({matchData.eligibleMatches?.length || 0})
                </h4>
                {(matchData.eligibleMatches || []).map((m: any) => (
                  <div
                    key={m.institutionId}
                    className="p-3.5 rounded-xl border border-emerald-500/30 bg-slate-950/80 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white text-sm">{m.institutionName}</div>
                        <div className="text-[10px] text-slate-400">
                          {m.facilityType} • {m.city} • Approx. {m.distanceKm} km (~{m.estimatedTransitMins} mins)
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                          Score: {(m.score * 100).toFixed(0)}%
                        </span>
                        <div className="text-xs font-bold text-white mt-1">
                          {m.eligibleUnitsAvailable} eligible units
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-lg">
                      {m.matchExplanation}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">
                        Next Action: {m.suggestedNextAction}
                      </span>
                      <Button
                        variant="primary"
                        onClick={() => {
                          setSelectedMatchRequestId(null);
                          setProposalTargetReq({
                            id: matchData.requestId,
                            bloodGroup: matchData.requestedBloodGroup,
                            unitsRequired: matchData.unitsRequired,
                          });
                          setProposalSourceCandidate(m);
                          setProposalUnits(Math.min(matchData.unitsRequired, m.eligibleUnitsAvailable));
                        }}
                        className="text-[11px] py-1 px-3"
                      >
                        Request Transfer Proposal
                      </Button>
                    </div>
                  </div>
                ))}
                {(!matchData.eligibleMatches || matchData.eligibleMatches.length === 0) && (
                  <p className="text-slate-500 italic">No single source holds full immediate isogroup capacity.</p>
                )}
              </div>

              {/* Potential Matches Requiring Clinical / Partial Review */}
              <div className="space-y-2.5 pt-2">
                <h4 className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                  2. Potential Matches Requiring Clinical or Partial Review (
                  {matchData.reviewRequiredMatches?.length || 0})
                </h4>
                {(matchData.reviewRequiredMatches || []).map((m: any) => (
                  <div
                    key={m.institutionId}
                    className="p-3.5 rounded-xl border border-amber-500/30 bg-slate-950/80 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white">{m.institutionName}</div>
                        <div className="text-[10px] text-slate-400">
                          {m.facilityType} • Approx. {m.distanceKm} km • Available: {m.eligibleUnitsAvailable}u
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                        {m.compatibilityTier}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">{m.matchExplanation}</p>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedMatchRequestId(null);
                          setProposalTargetReq({
                            id: matchData.requestId,
                            bloodGroup: matchData.requestedBloodGroup,
                            unitsRequired: matchData.unitsRequired,
                          });
                          setProposalSourceCandidate(m);
                          setProposalUnits(Math.min(matchData.unitsRequired, m.eligibleUnitsAvailable));
                        }}
                        className="text-[11px] py-1 px-3 border-amber-500/40 text-amber-300"
                      >
                        Propose Partial / Reviewed Transfer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ineligible Matches */}
              {matchData.ineligibleMatches && matchData.ineligibleMatches.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                    3. Ineligible Facilities ({matchData.ineligibleMatches.length})
                  </h4>
                  {matchData.ineligibleMatches.map((m: any) => (
                    <div
                      key={m.institutionId}
                      className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/40 flex items-center justify-between text-[11px] text-slate-400"
                    >
                      <span>
                        <strong className="text-slate-300">{m.institutionName}</strong> ({m.distanceKm} km)
                      </span>
                      <span className="text-rose-400">{m.ineligibilityReason}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* MODAL 3: SUBMIT TRANSFER PROPOSAL */}
      <Modal
        isOpen={!!proposalTargetReq}
        onClose={() => setProposalTargetReq(null)}
        title="Submit Blood Redistribution Proposal"
      >
        <form onSubmit={handleCreateProposalSubmit} className="space-y-4 text-xs">
          {proposalSourceCandidate && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="font-bold text-white">
                Source Facility: {proposalSourceCandidate.institutionName}
              </div>
              <div className="text-slate-400 text-[11px]">
                Available Eligible Units: {proposalSourceCandidate.eligibleUnitsAvailable} • Approx.{' '}
                {proposalSourceCandidate.distanceKm} km
              </div>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-300 mb-1">Units to Propose *</label>
            <input
              type="number"
              min={1}
              max={proposalTargetReq?.unitsRequired || 50}
              required
              value={proposalUnits}
              onChange={(e) => setProposalUnits(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Operational / Clinical Notes</label>
            <input
              type="text"
              placeholder="e.g., Units cross-match ready, courier available for immediate pickup"
              value={proposalNotes}
              onChange={(e) => setProposalNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setProposalTargetReq(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={createProposalMutation.isPending}>
              Submit Transfer Proposal
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: RECORD DISPATCH (Module G) */}
      <Modal
        isOpen={!!dispatchTarget}
        onClose={() => setDispatchTarget(null)}
        title="Record Authorized Cold-Chain Shipment Dispatch"
      >
        <form onSubmit={handleDispatchSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1">Authorized Dispatcher Name *</label>
            <input
              type="text"
              required
              placeholder="e.g., Dr. R. Sharma (Blood Bank Officer)"
              value={dispatcherName}
              onChange={(e) => setDispatcherName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Shipment Reference (Optional)</label>
              <input
                type="text"
                placeholder="Auto-generated if blank"
                value={shipmentRef}
                onChange={(e) => setShipmentRef(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1">Transport / Vehicle Details</label>
              <input
                type="text"
                value={vehicleDetails}
                onChange={(e) => setVehicleDetails(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Cold-Chain & Storage Notes</label>
            <input
              type="text"
              placeholder="e.g., Validated transport box #4, logger temp 4.1°C"
              value={coldChainNotes}
              onChange={(e) => setColdChainNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={tempConfirmed}
              onChange={(e) => setTempConfirmed(e.target.checked)}
              className="mt-0.5 accent-rose-600"
            />
            <span className="text-[11px] text-slate-300">
              I confirm that all reserved blood units have been inspected for bag integrity, proper labeling, and validated transport temperature compliance prior to dispatch.
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDispatchTarget(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!tempConfirmed}
              isLoading={dispatchMutation.isPending}
            >
              Confirm Dispatch
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: MANUAL IN-TRANSIT UPDATE */}
      <Modal
        isOpen={!!transitTarget}
        onClose={() => setTransitTarget(null)}
        title="Update Manual Shipment In-Transit Status"
      >
        <form onSubmit={handleInTransitSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1">Checkpoint / Transit Status Note *</label>
            <input
              type="text"
              required
              placeholder="e.g., Courier passed Silk Board junction; cold-chain seal intact"
              value={transitNotes}
              onChange={(e) => setTransitNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setTransitTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={inTransitMutation.isPending}>
              Save Transit Update
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 6: CONFIRM RECEIPT & QUANTITY RECONCILIATION (Module G) */}
      <Modal
        isOpen={!!receiveTarget}
        onClose={() => setReceiveTarget(null)}
        title="Confirm Shipment Receipt & Inventory Reconciliation"
      >
        <form onSubmit={handleReceiveSubmit} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
            Dispatched Quantity:{' '}
            <strong className="text-white">
              {receiveTarget?.unitsDispatched ?? receiveTarget?.unitsApproved} units
            </strong>{' '}
            of{' '}
            <strong className="text-rose-400">
              {formatBloodGroup(receiveTarget?.bloodGroup)} ({formatComponentType(receiveTarget?.componentType)})
            </strong>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Total Units Received *</label>
              <input
                type="number"
                min={0}
                max={receiveTarget?.unitsDispatched ?? receiveTarget?.unitsApproved ?? 50}
                required
                value={unitsReceived}
                onChange={(e) => setUnitsReceived(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1">Damaged / Unusable Units</label>
              <input
                type="number"
                min={0}
                max={unitsReceived}
                value={damagedUnits}
                onChange={(e) => setDamagedUnits(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Receiving Staff Member Name *</label>
            <input
              type="text"
              required
              placeholder="e.g., Nurse Priya Menon / Lab Tech K. Rao"
              value={receiverStaffName}
              onChange={(e) => setReceiverStaffName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={conditionVerified}
              onChange={(e) => setConditionVerified(e.target.checked)}
              className="mt-0.5 accent-emerald-500"
            />
            <span className="text-[11px] text-slate-300">
              Storage temperature log, seal integrity, and bag visual inspection passed upon arrival.
            </span>
          </label>

          {(unitsReceived !== (receiveTarget?.unitsDispatched ?? receiveTarget?.unitsApproved) ||
            damagedUnits > 0 ||
            !conditionVerified) && (
              <div>
                <label className="block font-bold text-rose-400 mb-1">
                  Discrepancy / Exception Explanation (Required) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Explain missing units, damaged bags, or temperature excursion..."
                  value={discrepancyReason}
                  onChange={(e) => setDiscrepancyReason(e.target.value)}
                  className="w-full bg-slate-950 border border-rose-500/50 rounded-xl px-3 py-2 text-white"
                />
              </div>
            )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setReceiveTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={receiveMutation.isPending}>
              Record Receipt & Reconcile Inventory
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 7: CANCEL TRANSFER */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Transfer & Release Reserved Stock"
      >
        <form onSubmit={handleCancelSubmit} className="space-y-4 text-xs">
          <p className="text-slate-300">
            Cancelling this transfer prior to dispatch will release all reserved blood units back to the source facility's available stock.
          </p>
          <div>
            <label className="block font-bold text-slate-300 mb-1">Cancellation Reason *</label>
            <input
              type="text"
              required
              placeholder="e.g., Patient surgery postponed / Local donor fulfilled requirement"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCancelTarget(null)}>
              Keep Transfer
            </Button>
            <Button type="submit" variant="primary" isLoading={cancelMutation.isPending}>
              Confirm Cancellation
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 7B: CANCEL REDISTRIBUTION REQUEST */}
      <Modal
        isOpen={!!cancelRequestTarget}
        onClose={() => setCancelRequestTarget(null)}
        title="Cancel Redistribution Request"
      >
        <form onSubmit={handleCancelRequestSubmit} className="space-y-4 text-xs">
          <p className="text-slate-300">
            Cancelling this redistribution request will close all pending proposals and release any pre-dispatch reserved units back to source available stock.
          </p>
          <div>
            <label className="block font-bold text-slate-300 mb-1">Cancellation Reason *</label>
            <input
              type="text"
              required
              placeholder="e.g., Requirement fulfilled via internal donor / Surgery rescheduled"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCancelRequestTarget(null)}>
              Keep Request
            </Button>
            <Button type="submit" variant="primary" isLoading={cancelRequestMutation.isPending}>
              Confirm Request Cancellation
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 8: RESOLVE DISCREPANCY & COMPLETE TRANSFER */}
      <Modal
        isOpen={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        title="Resolve Discrepancy & Finalize Transfer Completion"
      >
        <form onSubmit={handleCompleteSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Discrepancy Resolution & Quality Assurance Notes *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Damaged unit documented and discarded per protocol; remaining units verified"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCompleteTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={completeMutation.isPending}>
              Finalize Completion
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 9: REGISTER INSTITUTIONAL INVENTORY */}
      <Modal
        isOpen={isAddInvOpen}
        onClose={() => setIsAddInvOpen(false)}
        title="Register Institutional Blood / Component Batch"
      >
        <form onSubmit={handleAddInventorySubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Blood Group *</label>
              <select
                value={invBloodGroup}
                onChange={(e) => setInvBloodGroup(e.target.value as BloodGroupCode)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
              >
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {formatBloodGroup(bg)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1">Component Type *</label>
              <select
                value={invComponent}
                onChange={(e) => setInvComponent(e.target.value as BloodComponentCode)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
              >
                {COMPONENT_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {formatComponentType(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Units Count (Bags) *</label>
              <input
                type="number"
                min={1}
                max={200}
                required
                value={invUnits}
                onChange={(e) => setInvUnits(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1">Expiry Date *</label>
              <input
                type="date"
                required
                value={invExpiryDate}
                onChange={(e) => setInvExpiryDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Batch / Lot Identifier (Optional)</label>
            <input
              type="text"
              placeholder="e.g., LOT-2026-PRBC-884"
              value={invBatchNumber}
              onChange={(e) => setInvBatchNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddInvOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={addInventoryMutation.isPending}>
              Register Inventory Batch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Redistribution;
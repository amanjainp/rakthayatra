import { BloodGroup, BloodComponent } from '@prisma/client';

export type CompatibilityTier = 'ISOGROUP_EXACT' | 'COMPATIBLE_SUBSTITUTE' | 'CLINICAL_REVIEW_REQUIRED' | 'INCOMPATIBLE';

export interface ComponentStoragePolicy {
  componentType: BloodComponent;
  label: string;
  storageTempRange: string;
  transportTempRange: string;
  typicalShelfLifeDays: number;
  defaultMinRemainingDays: number;
  handlingRequirements: string;
}

export interface CompatibilityEvaluation {
  isCompatible: boolean;
  requiresClinicalReview: boolean;
  tier: CompatibilityTier;
  compatibilityScore: number; // 1.0 for exact match, 0.85 for compatible substitute, 0.65 for clinical review, 0 for incompatible
  requestedBloodGroup: BloodGroup;
  candidateBloodGroup: BloodGroup;
  componentType: BloodComponent;
  clinicalNote: string;
  regulatoryDisclaimer: string;
}

export const REGULATORY_DISCLAIMER =
  'Institutional logistics compatibility only. Software matching does not authorize clinical transfusion. Final suitability and release remain subject to pre-transfusion cross-matching, infectious disease screening, and authorized Blood Bank Medical Officer sign-off per CDSCO / NBTC guidelines.';

/**
 * Packed Red Blood Cells (PRBC) ABO/RhD Compatibility Matrix
 * Key: Recipient / Requested BloodGroup -> Value: Compatible Donor / Source BloodGroups
 */
export const PRBC_COMPATIBILITY_MATRIX: Record<BloodGroup, BloodGroup[]> = {
  O_NEG: [BloodGroup.O_NEG],
  O_POS: [BloodGroup.O_NEG, BloodGroup.O_POS],
  A_NEG: [BloodGroup.O_NEG, BloodGroup.A_NEG],
  A_POS: [BloodGroup.O_NEG, BloodGroup.O_POS, BloodGroup.A_NEG, BloodGroup.A_POS],
  B_NEG: [BloodGroup.O_NEG, BloodGroup.B_NEG],
  B_POS: [BloodGroup.O_NEG, BloodGroup.O_POS, BloodGroup.B_NEG, BloodGroup.B_POS],
  AB_NEG: [BloodGroup.O_NEG, BloodGroup.A_NEG, BloodGroup.B_NEG, BloodGroup.AB_NEG],
  AB_POS: [
    BloodGroup.O_NEG,
    BloodGroup.O_POS,
    BloodGroup.A_NEG,
    BloodGroup.A_POS,
    BloodGroup.B_NEG,
    BloodGroup.B_POS,
    BloodGroup.AB_NEG,
    BloodGroup.AB_POS,
  ],
};

/**
 * Fresh Frozen Plasma (FFP) ABO Compatibility Matrix
 * Reverse of cellular compatibility: AB is universal plasma donor; O plasma only for O recipients.
 * Key: Recipient / Requested BloodGroup -> Value: Compatible Donor / Source BloodGroups
 */
export const PLASMA_COMPATIBILITY_MATRIX: Record<BloodGroup, BloodGroup[]> = {
  AB_POS: [BloodGroup.AB_POS, BloodGroup.AB_NEG],
  AB_NEG: [BloodGroup.AB_NEG, BloodGroup.AB_POS],
  A_POS: [BloodGroup.A_POS, BloodGroup.A_NEG, BloodGroup.AB_POS, BloodGroup.AB_NEG],
  A_NEG: [BloodGroup.A_NEG, BloodGroup.A_POS, BloodGroup.AB_NEG, BloodGroup.AB_POS],
  B_POS: [BloodGroup.B_POS, BloodGroup.B_NEG, BloodGroup.AB_POS, BloodGroup.AB_NEG],
  B_NEG: [BloodGroup.B_NEG, BloodGroup.B_POS, BloodGroup.AB_NEG, BloodGroup.AB_POS],
  O_POS: [
    BloodGroup.O_POS,
    BloodGroup.O_NEG,
    BloodGroup.A_POS,
    BloodGroup.A_NEG,
    BloodGroup.B_POS,
    BloodGroup.B_NEG,
    BloodGroup.AB_POS,
    BloodGroup.AB_NEG,
  ],
  O_NEG: [
    BloodGroup.O_NEG,
    BloodGroup.O_POS,
    BloodGroup.A_NEG,
    BloodGroup.A_POS,
    BloodGroup.B_NEG,
    BloodGroup.B_POS,
    BloodGroup.AB_NEG,
    BloodGroup.AB_POS,
  ],
};

export const COMPONENT_STORAGE_POLICIES: Record<BloodComponent, ComponentStoragePolicy> = {
  WHOLE_BLOOD: {
    componentType: 'WHOLE_BLOOD',
    label: 'Whole Blood (CPDA-1)',
    storageTempRange: '2°C to 6°C',
    transportTempRange: '2°C to 10°C',
    typicalShelfLifeDays: 35,
    defaultMinRemainingDays: 3,
    handlingRequirements: 'Validated insulated transport box with conditioned ice packs; prevent direct contact with ice to avoid hemolysis.',
  },
  PACKED_RBC: {
    componentType: 'PACKED_RBC',
    label: 'Packed Red Blood Cells (PRBC)',
    storageTempRange: '2°C to 6°C',
    transportTempRange: '2°C to 10°C',
    typicalShelfLifeDays: 42,
    defaultMinRemainingDays: 3,
    handlingRequirements: 'Maintain 2°C–10°C cold chain during transit; inspect for hemolysis or clot formation upon receipt.',
  },
  PLASMA: {
    componentType: 'PLASMA',
    label: 'Fresh Frozen Plasma (FFP)',
    storageTempRange: '≤ -18°C to -30°C',
    transportTempRange: '≤ -18°C (Frozen)',
    typicalShelfLifeDays: 365,
    defaultMinRemainingDays: 7,
    handlingRequirements: 'Transport in frozen state with dry ice or frozen phase-change packs; check for signs of thawing.',
  },
  PLATELETS: {
    componentType: 'PLATELETS',
    label: 'Platelet Concentrate (RDP/SDP)',
    storageTempRange: '20°C to 24°C',
    transportTempRange: '20°C to 24°C',
    typicalShelfLifeDays: 5,
    defaultMinRemainingDays: 1,
    handlingRequirements: 'Keep at 20°C–24°C; DO NOT REFRIGERATE. Resume gentle continuous agitation immediately upon receipt.',
  },
  CRYOPRECIPITATE: {
    componentType: 'CRYOPRECIPITATE',
    label: 'Cryoprecipitate Antihemophilic Factor',
    storageTempRange: '≤ -18°C to -30°C',
    transportTempRange: '≤ -18°C (Frozen)',
    typicalShelfLifeDays: 365,
    defaultMinRemainingDays: 7,
    handlingRequirements: 'Maintain frozen state during transport; inspect bag integrity as frozen plastic is fragile.',
  },
};

export class CompatibilityService {
  /**
   * Returns all candidate source blood groups that can potentially fulfill a request
   * for the specified blood group and component type.
   */
  getCompatibleSourceGroups(
    requestedGroup: BloodGroup,
    componentType: BloodComponent = 'WHOLE_BLOOD',
    includeClinicalReviewCandidates: boolean = true
  ): BloodGroup[] {
    switch (componentType) {
      case 'PACKED_RBC':
        return PRBC_COMPATIBILITY_MATRIX[requestedGroup] || [requestedGroup];

      case 'WHOLE_BLOOD':
        // Isogroup is strictly preferred for Whole Blood due to anti-A/anti-B in plasma;
        // compatible PRBC groups require clinical review (e.g., low-titer O whole blood).
        if (!includeClinicalReviewCandidates) {
          return [requestedGroup];
        }
        return PRBC_COMPATIBILITY_MATRIX[requestedGroup] || [requestedGroup];

      case 'PLASMA':
        return PLASMA_COMPATIBILITY_MATRIX[requestedGroup] || [requestedGroup];

      case 'PLATELETS':
        // Platelets prefer isogroup, then plasma-compatible or RhD-compatible with clinical review
        if (!includeClinicalReviewCandidates) {
          return [requestedGroup];
        }
        return Array.from(
          new Set([
            requestedGroup,
            ...(PLASMA_COMPATIBILITY_MATRIX[requestedGroup] || []),
            ...(PRBC_COMPATIBILITY_MATRIX[requestedGroup] || []),
          ])
        );

      case 'CRYOPRECIPITATE':
        if (!includeClinicalReviewCandidates) {
          return PLASMA_COMPATIBILITY_MATRIX[requestedGroup] || [requestedGroup];
        }
        return [
          BloodGroup.O_NEG,
          BloodGroup.O_POS,
          BloodGroup.A_NEG,
          BloodGroup.A_POS,
          BloodGroup.B_NEG,
          BloodGroup.B_POS,
          BloodGroup.AB_NEG,
          BloodGroup.AB_POS,
        ];

      default:
        return [requestedGroup];
    }
  }

  /**
   * Evaluates compatibility between a requested blood group/component and a candidate source unit.
   */
  evaluateCompatibility(
    requestedGroup: BloodGroup,
    candidateGroup: BloodGroup,
    componentType: BloodComponent = 'WHOLE_BLOOD'
  ): CompatibilityEvaluation {
    // 1. Exact Isogroup Match
    if (requestedGroup === candidateGroup) {
      return {
        isCompatible: true,
        requiresClinicalReview: false,
        tier: 'ISOGROUP_EXACT',
        compatibilityScore: 1.0,
        requestedBloodGroup: requestedGroup,
        candidateBloodGroup: candidateGroup,
        componentType,
        clinicalNote: `Exact ABO/RhD isogroup match (${candidateGroup.replace('_', ' ')}) for ${componentType}. Standard pre-transfusion verification applies.`,
        regulatoryDisclaimer: REGULATORY_DISCLAIMER,
      };
    }

    // 2. Component-Specific Evaluation
    if (componentType === 'PACKED_RBC') {
      const compatible = PRBC_COMPATIBILITY_MATRIX[requestedGroup]?.includes(candidateGroup) ?? false;
      if (compatible) {
        return {
          isCompatible: true,
          requiresClinicalReview: false,
          tier: 'COMPATIBLE_SUBSTITUTE',
          compatibilityScore: 0.85,
          requestedBloodGroup: requestedGroup,
          candidateBloodGroup: candidateGroup,
          componentType,
          clinicalNote: `ABO/RhD cellular-compatible Packed RBC substitute (${candidateGroup.replace('_', ' ')} → ${requestedGroup.replace('_', ' ')}). Cross-match required before release.`,
          regulatoryDisclaimer: REGULATORY_DISCLAIMER,
        };
      }
    } else if (componentType === 'WHOLE_BLOOD') {
      const rbcCompatible = PRBC_COMPATIBILITY_MATRIX[requestedGroup]?.includes(candidateGroup) ?? false;
      if (rbcCompatible) {
        return {
          isCompatible: true,
          requiresClinicalReview: true,
          tier: 'CLINICAL_REVIEW_REQUIRED',
          compatibilityScore: 0.65,
          requestedBloodGroup: requestedGroup,
          candidateBloodGroup: candidateGroup,
          componentType,
          clinicalNote: `Non-isogroup Whole Blood (${candidateGroup.replace('_', ' ')} → ${requestedGroup.replace('_', ' ')}). Requires Blood Bank Medical Officer review for plasma isoagglutinin titer safety; Packed RBC or isogroup Whole Blood preferred.`,
          regulatoryDisclaimer: REGULATORY_DISCLAIMER,
        };
      }
    } else if (componentType === 'PLASMA') {
      const plasmaCompatible = PLASMA_COMPATIBILITY_MATRIX[requestedGroup]?.includes(candidateGroup) ?? false;
      if (plasmaCompatible) {
        return {
          isCompatible: true,
          requiresClinicalReview: false,
          tier: 'COMPATIBLE_SUBSTITUTE',
          compatibilityScore: 0.85,
          requestedBloodGroup: requestedGroup,
          candidateBloodGroup: candidateGroup,
          componentType,
          clinicalNote: `ABO antibody-compatible Plasma (${candidateGroup.replace('_', ' ')} donor plasma lacks antibodies against ${requestedGroup.replace('_', ' ')} red cells).`,
          regulatoryDisclaimer: REGULATORY_DISCLAIMER,
        };
      }
    } else if (componentType === 'PLATELETS') {
      const plasmaCompatible = PLASMA_COMPATIBILITY_MATRIX[requestedGroup]?.includes(candidateGroup) ?? false;
      const rbcCompatible = PRBC_COMPATIBILITY_MATRIX[requestedGroup]?.includes(candidateGroup) ?? false;
      const reqIsRhNeg = requestedGroup.endsWith('_NEG');
      const candIsRhPos = candidateGroup.endsWith('_POS');

      if (plasmaCompatible && !(reqIsRhNeg && candIsRhPos)) {
        return {
          isCompatible: true,
          requiresClinicalReview: false,
          tier: 'COMPATIBLE_SUBSTITUTE',
          compatibilityScore: 0.82,
          requestedBloodGroup: requestedGroup,
          candidateBloodGroup: candidateGroup,
          componentType,
          clinicalNote: `Plasma- and RhD-compatible Platelet unit (${candidateGroup.replace('_', ' ')} → ${requestedGroup.replace('_', ' ')}).`,
          regulatoryDisclaimer: REGULATORY_DISCLAIMER,
        };
      }

      if (plasmaCompatible || rbcCompatible) {
        return {
          isCompatible: true,
          requiresClinicalReview: true,
          tier: 'CLINICAL_REVIEW_REQUIRED',
          compatibilityScore: 0.65,
          requestedBloodGroup: requestedGroup,
          candidateBloodGroup: candidateGroup,
          componentType,
          clinicalNote: `Secondary Platelet match (${candidateGroup.replace('_', ' ')} → ${requestedGroup.replace('_', ' ')}). ${reqIsRhNeg && candIsRhPos
              ? 'RhD-positive platelets for RhD-negative recipient requires clinical authorization and RhIG evaluation.'
              : 'Verify donor plasma antibody titer before release.'
            }`,
          regulatoryDisclaimer: REGULATORY_DISCLAIMER,
        };
      }
    } else if (componentType === 'CRYOPRECIPITATE') {
      const plasmaCompatible = PLASMA_COMPATIBILITY_MATRIX[requestedGroup]?.includes(candidateGroup) ?? false;
      return {
        isCompatible: true,
        requiresClinicalReview: !plasmaCompatible,
        tier: plasmaCompatible ? 'COMPATIBLE_SUBSTITUTE' : 'CLINICAL_REVIEW_REQUIRED',
        compatibilityScore: plasmaCompatible ? 0.85 : 0.65,
        requestedBloodGroup: requestedGroup,
        candidateBloodGroup: candidateGroup,
        componentType,
        clinicalNote: plasmaCompatible
          ? `ABO-compatible Cryoprecipitate (${candidateGroup.replace('_', ' ')} → ${requestedGroup.replace('_', ' ')}).`
          : `Cross-group Cryoprecipitate (${candidateGroup.replace('_', ' ')} → ${requestedGroup.replace('_', ' ')}) requires clinical review of plasma volume.`,
        regulatoryDisclaimer: REGULATORY_DISCLAIMER,
      };
    }

    return {
      isCompatible: false,
      requiresClinicalReview: false,
      tier: 'INCOMPATIBLE',
      compatibilityScore: 0,
      requestedBloodGroup: requestedGroup,
      candidateBloodGroup: candidateGroup,
      componentType,
      clinicalNote: `Incompatible ${componentType} pairing (${candidateGroup.replace('_', ' ')} cannot be allocated for ${requestedGroup.replace('_', ' ')}).`,
      regulatoryDisclaimer: REGULATORY_DISCLAIMER,
    };
  }

  /**
   * Returns storage and transport policy metadata for a component type.
   */
  getStoragePolicy(componentType: BloodComponent = 'WHOLE_BLOOD'): ComponentStoragePolicy {
    return COMPONENT_STORAGE_POLICIES[componentType] || COMPONENT_STORAGE_POLICIES.WHOLE_BLOOD;
  }
}

export const compatibilityService = new CompatibilityService();

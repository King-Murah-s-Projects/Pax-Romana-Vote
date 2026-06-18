import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Base API configuration
const BASE_URL = 'http://localhost:3000/api/v1';

// Create axios instance
const apiInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiInstance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('imcs-pax-romana-token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
);

// Response interceptor to handle auth errors
apiInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('imcs-pax-romana-token');
        localStorage.removeItem('imcs-pax-romana-user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
);

// Types
export type UserRole = "SUPER_ADMIN" | "EC_MEMBER" | "VOTER" | "ADMIN" | "ASPIRANT";

export type CandidatePosition =
    | "PRESIDENT"
    | "VICE_PRESIDENT"
    | "GENERAL_SECRETARY"
    | "FINANCIAL_SECRETARY"
    | "ORGANIZING_SECRETARY_MAIN"
    | "ORGANIZING_SECRETARY_ASSISTANT"
    | "PRO_MAIN"
    | "PRO_ASSISTANT"
    | "WOMEN_COMMISSIONER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  isActive: boolean;
  phoneNumber?: string;
  sessionId?: string;
  token?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface Candidate {
  id: string;
  name: string;
  position: CandidatePosition;
  image?: string;
  photoUrl?: string;
  statement?: string;
  voteCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCandidateDto {
  name: string;
  position: CandidatePosition;
  statement?: string;
}

export interface UpdateCandidateDto {
  name?: string;
  position?: CandidatePosition;
  statement?: string;
}

export interface CandidatePhotoDto {
  candidateId?: string;
  description?: string;
}

export interface UploadResponseDto {
  message: string;
  photoUrl: string;
  publicId: string;
  originalName: string;
  size: number;
}

export interface Position {
  id: string;
  title: string;
  candidates: Candidate[];
  maxSelections: number;
  position: CandidatePosition;
}

export interface BallotResponse {
  positions: Position[];
  timeRemaining?: string;
  electionStatus?: string;
}

export interface GenerateOtpDto {
  phoneNumber: string;
  name: string;
  email: string;
}

export interface VerifyOtpDto {
  phoneNumber: string;
  otp: string;
  email: string;
}

export interface OtpResponse {
  success: boolean;
  message: string;
  sessionId?: string;
  timeRemaining?: number;
}

export interface VerifyOtpResponse {
  expiresAt: any;
  voter: string;
  success: boolean;
  message: string;
  sessionId: string;
  user: {
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
  };
  token: string;
}

export interface SubmitVoteDto {
  sessionId: string;
  votes: Record<string, string[]>;
}

export interface SubmitVoteResponse {
  success: boolean;
  message: string;
  voteId?: string;
  timestamp?: string;
}

export interface VotingStats {
  status: string;
  timeRemaining: string;
  totalVoters: number;
  votesSubmitted: number;
  turnoutPercentage: number;
  activeVoters: number;
  positionStats: Array<{
    position: CandidatePosition;
    totalVotes: number;
    percentage: number;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const VOTING_STATS_KEY = 'imcs-voting-stats'
const CANDIDATES_STORAGE_KEY = 'imcs-candidates'
const VOTES_STORAGE_KEY = 'imcs-votes'

const normalizePhoneNumber = (phone: string): string => {
  if (!phone) return phone;

  const digitsOnly = phone.replace(/\D/g, '');

  if (digitsOnly.startsWith('233')) {
    return digitsOnly;
  } else if (digitsOnly.startsWith('0')) {
    return '233' + digitsOnly.substring(1);
  } else if (digitsOnly.length === 9) {
    return '233' + digitsOnly;
  }

  return digitsOnly;
};

export const candidatesApi = {
  async create(candidateData: CreateCandidateDto, nominationId?: string): Promise<Candidate> {
    const url = nominationId ? `/candidates?nominationId=${nominationId}` : '/candidates';
    const response: AxiosResponse<{ data: Candidate }> = await apiInstance.post(url, candidateData);
    return response.data.data;
  },

  async getAllForAdmin(): Promise<Candidate[]> {
    const response: AxiosResponse<{ data: Candidate[] }> = await apiInstance.get('/candidates/admin/all');
    return response.data.data;
  },

  async getByIdForAdmin(id: string): Promise<Candidate> {
    const response: AxiosResponse<{ data: Candidate }> = await apiInstance.get(`/candidates/admin/${id}`);
    return response.data.data;
  },

  async update(id: string, updateData: UpdateCandidateDto): Promise<Candidate> {
    const response: AxiosResponse<{ data: Candidate }> = await apiInstance.patch(`/candidates/${id}`, updateData);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await apiInstance.delete(`/candidates/${id}`);
  },

  async uploadPhoto(id: string, file: File): Promise<UploadResponseDto> {
    const formData = new FormData();
    formData.append('photo', file);

    const response: AxiosResponse<{ data: UploadResponseDto }> = await apiInstance.post(
        `/candidates/${id}/photo`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
    );
    return response.data.data;
  },

  async getBallot(): Promise<BallotResponse> {
    try {
      const candidates = JSON.parse(localStorage.getItem(CANDIDATES_STORAGE_KEY) || '[]') as Candidate[];
      const stats = JSON.parse(localStorage.getItem(VOTING_STATS_KEY) || '{}') as VotingStats;

      const positions: Position[] = Object.keys(positionDisplayNames).map(position => ({
        id: position.toLowerCase().replace(/_/g, '-'),
        title: positionDisplayNames[position as CandidatePosition],
        position: position as CandidatePosition,
        candidates: candidates.filter(c => c.position === position).map(c => ({
          ...c,
          image: c.photoUrl || "/placeholder.svg?height=150&width=150"
        })),
        maxSelections: 1
      })).filter(pos => pos.candidates.length > 0);

      return {
        positions,
        timeRemaining: stats?.timeRemaining || "2h 34m",
        electionStatus: stats?.status || "active"
      };
    } catch (error) {
      console.error('Error loading ballot from localStorage:', error);
      return {
        positions: [],
        timeRemaining: "2h 34m",
        electionStatus: "active"
      };
    }
  },

  async getByPosition(position: CandidatePosition): Promise<Candidate[]> {
    const response: AxiosResponse<{ data: Candidate[] }> = await apiInstance.get(`/candidates/position/${position}`);
    return response.data.data;
  },

  async getUnopposedPositions(): Promise<Array<{ position: CandidatePosition; candidate: Candidate }>> {
    const response: AxiosResponse<{ data: Array<{ position: CandidatePosition; candidate: Candidate }> }> =
        await apiInstance.get('/candidates/unopposed');
    return response.data.data;
  },
};

export const fileUploadApi = {
  async uploadCandidatePhoto(file: File, candidatePhotoDto: CandidatePhotoDto): Promise<UploadResponseDto> {
    const formData = new FormData();
    formData.append('photo', file);

    if (candidatePhotoDto.candidateId) {
      formData.append('candidateId', candidatePhotoDto.candidateId);
    }
    if (candidatePhotoDto.description) {
      formData.append('description', candidatePhotoDto.description);
    }

    const response: AxiosResponse<UploadResponseDto> = await apiInstance.post(
        '/file-upload/candidate-photo',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
    );
    return response.data;
  },

  async deleteFile(publicId: string): Promise<{ message: string }> {
    const response: AxiosResponse<{ message: string }> = await apiInstance.delete(`/file-upload/${publicId}`);
    return response.data;
  },

  async getFileInfo(publicId: string): Promise<any> {
    const response = await apiInstance.get(`/file-upload/info/${publicId}`);
    return response.data;
  },

  async getPhotoUrls(publicId: string): Promise<any> {
    const response = await apiInstance.get(`/file-upload/urls/${publicId}`);
    return response.data;
  },
};

export const authApi = {
  async sendVerificationCode(email: string, name?: string): Promise<any> {
    const response = await apiInstance.post('/auth/send-code', { email, name });
    return response.data;
  },

  async verifyEmailAndLogin(email: string, verificationCode: string): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await apiInstance.post('/auth/verify-email', { email, verificationCode });
    return response.data;
  },

  async adminLogin(email: string, password: string): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await apiInstance.post('/auth/admin-login', { email, password });
    return response.data;
  },

  async getProfile(): Promise<User> {
    const response: AxiosResponse<User> = await apiInstance.get('/auth/profile');
    return response.data;
  },

  async logout(): Promise<{ message: string }> {
    const response: AxiosResponse<{ message: string }> = await apiInstance.post('/auth/logout');
    return response.data;
  },
};

export const votingApi = {
  async generateOtp(data: GenerateOtpDto): Promise<OtpResponse> {
    const response: AxiosResponse<OtpResponse> = await apiInstance.post('/voting/generate-otp', data);
    return response.data;
  },

  async verifyOtp(data: VerifyOtpDto): Promise<VerifyOtpResponse> {
    const response: AxiosResponse<VerifyOtpResponse> = await apiInstance.post('/voting/verify-otp', data);
    return response.data;
  },

  async getBallot(): Promise<BallotResponse> {
    return candidatesApi.getBallot();
  },

  async submitVote(data: SubmitVoteDto): Promise<SubmitVoteResponse> {
    try {
      const currentVotes = JSON.parse(localStorage.getItem(VOTES_STORAGE_KEY) || '{}') as Record<string, string[]>;
      const voteId = `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      currentVotes[voteId] = Object.values(data.votes).flat();
      localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(currentVotes));

      const stats = JSON.parse(localStorage.getItem(VOTING_STATS_KEY) || '{}') as VotingStats;
      const updatedStats = {
        ...stats,
        votesSubmitted: (stats.votesSubmitted || 0) + 1,
        turnoutPercentage: stats.totalVoters ? ((stats.votesSubmitted || 0) + 1) / stats.totalVoters * 100 : 0
      };
      localStorage.setItem(VOTING_STATS_KEY, JSON.stringify(updatedStats));

      return {
        success: true,
        message: "Vote submitted successfully",
        voteId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error submitting vote:', error);
      return {
        success: false,
        message: handleApiError(error)
      };
    }
  },

  async validateSession(sessionId: string): Promise<{ valid: boolean; message: string }> {
    const response: AxiosResponse<{ valid: boolean; message: string }> = await apiInstance.get(`/voting/session/${sessionId}/validate`);
    return response.data;
  },

  async getVotingStats(): Promise<VotingStats> {
    try {
      const stats = JSON.parse(localStorage.getItem(VOTING_STATS_KEY) || '{}') as VotingStats;
      const candidates = JSON.parse(localStorage.getItem(CANDIDATES_STORAGE_KEY) || '[]') as Candidate[];
      const votes = JSON.parse(localStorage.getItem(VOTES_STORAGE_KEY) || '{}') as Record<string, string[]>;

      const positionStats = Object.keys(positionDisplayNames).map(position => {
        const positionCandidates = candidates.filter(c => c.position === position);
        const totalVotes = Object.values(votes).reduce((sum, vote) => {
          return sum + vote.filter(candidateId => positionCandidates.some(c => c.id === candidateId)).length;
        }, 0);

        return {
          position: position as CandidatePosition,
          totalVotes,
          percentage: stats.totalVoters ? (totalVotes / stats.totalVoters * 100) : 0
        };
      });

      return {
        status: "", timeRemaining: "",
        totalVoters: stats.totalVoters || 1247,
        votesSubmitted: stats.votesSubmitted || 0,
        turnoutPercentage: stats.turnoutPercentage || 0,
        activeVoters: stats.activeVoters || 0,
        positionStats
      };
    } catch (error) {
      console.error('Error loading voting stats:', error);
      return {
        status: "", timeRemaining: "",
        totalVoters: 1247,
        votesSubmitted: 0,
        turnoutPercentage: 0,
        activeVoters: 0,
        positionStats: []
      };
    }
  },

  async getVotingProgress(): Promise<VotingStats> {
    return votingApi.getVotingStats();
  },

  async getPublicDashboard(): Promise<any> {
    const response = await apiInstance.get('/voting/dashboard/public');
    return response.data;
  },

  async getPositionStats(position: CandidatePosition): Promise<any> {
    const response = await apiInstance.get(`/voting/position/${position}/stats`);
    return response.data;
  },

  async refreshStats(): Promise<any> {
    const response = await apiInstance.post('/voting/stats/refresh');
    return response.data;
  },

  async getVotingVelocity(): Promise<any> {
    const response = await apiInstance.get('/voting/velocity');
    return response.data;
  },

  async getVotingAnalytics(params?: { timeframe?: string; position?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.timeframe) queryParams.append('timeframe', params.timeframe);
    if (params?.position) queryParams.append('position', params.position);

    const response = await apiInstance.get(`/voting/analytics?${queryParams.toString()}`);
    return response.data;
  },

  async getSystemHealth(): Promise<any> {
    const response = await apiInstance.get('/voting/health');
    return response.data;
  },

  async getAnomalies(): Promise<any> {
    const response = await apiInstance.get('/voting/anomalies');
    return response.data;
  },

  async pauseVoting(reason: string): Promise<any> {
    const response = await apiInstance.put('/voting/emergency/pause', { reason });
    return response.data;
  },

  async resumeVoting(reason: string): Promise<any> {
    const response = await apiInstance.put('/voting/emergency/resume', { reason });
    return response.data;
  },

  async getActiveSessions(): Promise<any> {
    const response = await apiInstance.get('/voting/sessions/active');
    return response.data;
  },

  async exportVotingData(params?: { format?: string; includePersonalData?: boolean }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.format) queryParams.append('format', params.format);
    if (params?.includePersonalData) queryParams.append('includePersonalData', params.includePersonalData.toString());

    const response = await apiInstance.get(`/voting/export?${queryParams.toString()}`);
    return response.data;
  },

  async testRealtimeConnection(): Promise<any> {
    const response = await apiInstance.post('/voting/test/realtime');
    return response.data;
  },

  async getVotingTimeline(): Promise<any> {
    const response = await apiInstance.get('/voting/timeline');
    return response.data;
  },
};

export const apiClient = {
  async sendVerification(data: { name: string; phoneNumber: string; email: string }): Promise<OtpResponse> {
    const normalizedData = {
      ...data,
      phoneNumber: normalizePhoneNumber(data.phoneNumber)
    };
    return votingApi.generateOtp(normalizedData);
  },

  async verifyCode(data: { phoneNumber: string; otp: string; email: string }): Promise<VerifyOtpResponse> {
    const normalizedData = {
      phoneNumber: normalizePhoneNumber(data.phoneNumber),
      otp: data.otp,
      email: data.email,
    };
    return votingApi.verifyOtp(normalizedData);
  },

  ...authApi,
  ...votingApi,
  candidates: candidatesApi,
  fileUpload: fileUploadApi,
};

export const handleApiError = (error: any): string => {
  console.error('API Error Details:', {
    status: error.response?.status,
    data: error.response?.data,
    message: error.message,
    config: {
      url: error.config?.url,
      method: error.config?.method,
      data: error.config?.data,
    }
  });

  if (error.response?.status === 422) {
    const validationError = error.response?.data?.message || error.response?.data?.error;
    if (Array.isArray(validationError)) {
      return validationError.join(', ');
    } else if (typeof validationError === 'string') {
      return validationError;
    } else {
      return 'Validation failed. Please check your input.';
    }
  }

  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

export const positionDisplayNames: Record<CandidatePosition, string> = {
  PRESIDENT: "President",
  VICE_PRESIDENT: "Vice President",
  GENERAL_SECRETARY: "General Secretary",
  FINANCIAL_SECRETARY: "Financial Secretary",
  ORGANIZING_SECRETARY_MAIN: "Organizing Secretary (Main)",
  ORGANIZING_SECRETARY_ASSISTANT: "Organizing Secretary (Assistant)",
  PRO_MAIN: "PRO (Main)",
  PRO_ASSISTANT: "PRO (Assistant)",
  WOMEN_COMMISSIONER: "Women Commissioner",
};

export { apiInstance };

export class usersApi {
  static async create(param: {name: string; email: string; role: "SUPER_ADMIN" | "EC_MEMBER" | "VOTER" | "ADMIN" | "ASPIRANT"}) {
    const response = await apiInstance.post('/users', param);
    return response.data;
  }
}
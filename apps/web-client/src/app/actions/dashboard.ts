'use server';

// Lập trình mô phỏng DB bằng 1 biến global để demo tính năng "Seed 1 lần"
let mockDbSeeded = false;

interface CourseStat {
  id: string;
  title: string;
  progress: number;
  thumbnail: string;
  instructor: string;
  lastAccessed: string;
}

interface DashboardData {
  stats: {
    totalHours: number;
    coursesCompleted: number;
    certificates: number;
    activeDiscussions: number;
  };
  activeCourses: CourseStat[];
  recommendedCourses: any[];
}

export async function getDashboardData(): Promise<{ success: boolean; data?: DashboardData; seeded: boolean }> {
  // Simulate network
  await new Promise(resolve => setTimeout(resolve, 800));

  const isSeeding = !mockDbSeeded;
  
  if (!mockDbSeeded) {
    // Database rỗng -> Tiến hành "Seed" dữ liệu mẫu
    console.log('[Seed] Database rỗng. Đang tạo dữ liệu mẫu cho Dashboard...');
    mockDbSeeded = true;
  }

  // Khởi tạo Dữ liệu Mẫu (Mock DB)
  const dashboardData: DashboardData = {
    stats: {
      totalHours: 124,
      coursesCompleted: 3,
      certificates: 2,
      activeDiscussions: 15,
    },
    activeCourses: [
      {
        id: 'c1',
        title: 'Fullstack Next.js & Microservices',
        progress: 68,
        thumbnail: 'NX',
        instructor: 'Lê Minh Tôn',
        lastAccessed: '2 giờ trước'
      },
      {
        id: 'c2',
        title: 'Bảo mật Ứng dụng Web (OWASP/JWT)',
        progress: 32,
        thumbnail: 'SEC',
        instructor: 'Trần Văn Cường',
        lastAccessed: 'Hôm qua'
      }
    ],
    recommendedCourses: [
      {
        id: 'r1',
        title: 'System Design Interview Cơ Bản',
        category: 'Software Architecture',
        price: 'Nâng cấp nền tảng',
        lessons: 35,
        rating: '4.9',
      },
      {
        id: 'r2',
        title: 'Triển khai Docker & Kubernetes',
        category: 'DevOps',
        price: '1.490.000đ',
        lessons: 42,
        rating: '4.8',
      },
      {
        id: 'r3',
        title: 'GraphQL API Masterclass',
        category: 'Web Development',
        price: '890.000đ',
        lessons: 28,
        rating: '4.7',
      }
    ]
  };

  return {
    success: true,
    data: dashboardData,
    seeded: isSeeding, // Cờ báo cho UI biết để hiển thị Toast "Đã tạo dữ liệu mẫu"
  };
}

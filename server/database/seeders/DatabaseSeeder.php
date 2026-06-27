<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\Building;
use App\Models\Room;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(SettingsSeeder::class);

        // ── Users ────────────────────────────────────────────────────────────
        $admin = User::create([
            'name' => 'Anita Wijaya', 'email' => 'anita@corp.com',
            'password' => Hash::make('password'), 'department' => 'GAA',
            'role' => 'admin', 'ext' => '102', 'avatar' => 'Anita',
        ]);

        $user1 = User::create([
            'name' => 'Jessica Miller', 'email' => 'jessica@corp.com',
            'password' => Hash::make('password'), 'department' => 'HRD',
            'role' => 'user', 'ext' => '801', 'avatar' => 'Aria',
        ]);

        $user2 = User::create([
            'name' => 'Fixer Team', 'email' => 'mtc@corp.com',
            'password' => Hash::make('password'), 'department' => 'MTC',
            'role' => 'user', 'ext' => '000', 'avatar' => 'Felix',
        ]);

        // ── Buildings ────────────────────────────────────────────────────────
        $ho = Building::create([
            'name' => 'Head Office', 'code' => 'HO',
            'address' => 'Jl. Sudirman No. 1, Jakarta Pusat',
            'floors' => 12, 'is_active' => true,
            'notes' => 'Main corporate headquarters.',
        ]);

        $ct = Building::create([
            'name' => 'Creative Tower', 'code' => 'CT',
            'address' => 'Jl. Asia Afrika No. 8, Bandung',
            'floors' => 8, 'is_active' => true,
            'notes' => 'Creative & design hub.',
        ]);

        $sh = Building::create([
            'name' => 'South Hub', 'code' => 'SH',
            'address' => 'Jl. HR Muhammad No. 5, Surabaya',
            'floors' => 5, 'is_active' => true,
            'notes' => 'Regional office for East Java operations.',
        ]);

        // ── Rooms: Head Office ───────────────────────────────────────────────
        $b1 = Room::create([
            'building_id' => $ho->id,
            'name' => 'Ballroom 101', 'capacity' => 100, 'floor' => 'B1',
            'facilities' => [['name'=>'Sound','icon'=>'volume_up'],['name'=>'Stage','icon'=>'layers'],['name'=>'Projector','icon'=>'videocam'],['name'=>'AC','icon'=>'ac_unit']],
            'photos' => ['https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=800','https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=800'],
            'notes' => 'Suitable for large-scale events. Coordinate with GA team 48hrs before for stage/AV setup.',
        ]);

        $b2 = Room::create([
            'building_id' => $ho->id,
            'name' => 'Ballroom 102', 'capacity' => 100, 'floor' => 'B1',
            'facilities' => [['name'=>'Sound','icon'=>'volume_up'],['name'=>'Stage','icon'=>'layers'],['name'=>'AC','icon'=>'ac_unit']],
            'photos' => ['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800'],
            'notes' => 'Suitable for large-scale events.',
        ]);

        $e1 = Room::create([
            'building_id' => $ho->id,
            'name' => 'Executive 101', 'capacity' => 12, 'floor' => '5F',
            'facilities' => [['name'=>'4K TV','icon'=>'tv'],['name'=>'Webcam','icon'=>'photo_camera'],['name'=>'Wifi','icon'=>'wifi'],['name'=>'Whiteboard','icon'=>'border_color']],
            'photos' => ['https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=800','https://images.unsplash.com/photo-1462826303086-329426d1aef5?q=80&w=800'],
            'notes' => 'For senior leadership and external meetings. Video conferencing pre-configured.',
        ]);

        $e2 = Room::create([
            'building_id' => $ho->id,
            'name' => 'Executive 102', 'capacity' => 12, 'floor' => '5F',
            'facilities' => [['name'=>'4K TV','icon'=>'tv'],['name'=>'Wifi','icon'=>'wifi'],['name'=>'Whiteboard','icon'=>'border_color']],
            'photos' => ['https://images.unsplash.com/photo-1560472354-b33ff0c44a43?q=80&w=800'],
            'notes' => 'Executive suite with full AV setup.',
        ]);

        $f1 = Room::create([
            'building_id' => $ho->id,
            'name' => 'Focus 101', 'capacity' => 4, 'floor' => '3F',
            'facilities' => [['name'=>'AC','icon'=>'ac_unit'],['name'=>'Wifi','icon'=>'wifi']],
            'photos' => ['https://images.unsplash.com/photo-1505409859467-3a799be57c8f?q=80&w=800','https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=800'],
            'notes' => 'Quiet zone - no phone calls. Max 4 pax strictly enforced.',
        ]);

        Room::create([
            'building_id' => $ho->id,
            'name' => 'Focus 102', 'capacity' => 4, 'floor' => '3F',
            'facilities' => [['name'=>'AC','icon'=>'ac_unit'],['name'=>'Wifi','icon'=>'wifi']],
            'photos' => ['https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800'],
            'notes' => 'Quiet zone for focused work.',
        ]);

        // ── Rooms: Creative Tower ────────────────────────────────────────────
        Room::create([
            'building_id' => $ct->id,
            'name' => 'Ballroom 201', 'capacity' => 80, 'floor' => 'B1',
            'facilities' => [['name'=>'Projector','icon'=>'videocam'],['name'=>'AC','icon'=>'ac_unit'],['name'=>'Sound','icon'=>'volume_up']],
            'photos' => ['https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=800'],
            'notes' => 'Medium ballroom for events up to 80 pax.',
        ]);

        $e3 = Room::create([
            'building_id' => $ct->id,
            'name' => 'Executive 201', 'capacity' => 8, 'floor' => '4F',
            'facilities' => [['name'=>'TV','icon'=>'tv'],['name'=>'Wifi','icon'=>'wifi'],['name'=>'Whiteboard','icon'=>'border_color']],
            'photos' => ['https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=800'],
            'notes' => 'Smaller executive room for focused discussions.',
        ]);

        Room::create([
            'building_id' => $ct->id,
            'name' => 'Focus 201', 'capacity' => 6, 'floor' => '2F',
            'facilities' => [['name'=>'Whiteboard','icon'=>'border_color'],['name'=>'Wifi','icon'=>'wifi']],
            'photos' => ['https://images.unsplash.com/photo-1505409859467-3a799be57c8f?q=80&w=800'],
            'notes' => 'Small meeting room for quick discussions.',
        ]);

        Room::create([
            'building_id' => $ct->id,
            'name' => 'Focus 202', 'capacity' => 4, 'floor' => '2F',
            'facilities' => [['name'=>'AC','icon'=>'ac_unit'],['name'=>'Wifi','icon'=>'wifi']],
            'photos' => ['https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800'],
            'notes' => 'Creative quiet pod.',
        ]);

        // ── Rooms: South Hub ─────────────────────────────────────────────────
        $b3 = Room::create([
            'building_id' => $sh->id,
            'name' => 'Ballroom 301', 'capacity' => 60, 'floor' => 'B1',
            'facilities' => [['name'=>'Projector','icon'=>'videocam'],['name'=>'AC','icon'=>'ac_unit'],['name'=>'Sound','icon'=>'volume_up']],
            'photos' => ['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800'],
            'notes' => 'Regional event space.',
        ]);

        Room::create([
            'building_id' => $sh->id,
            'name' => 'Executive 301', 'capacity' => 10, 'floor' => '3F',
            'facilities' => [['name'=>'4K TV','icon'=>'tv'],['name'=>'Webcam','icon'=>'photo_camera'],['name'=>'Wifi','icon'=>'wifi']],
            'photos' => ['https://images.unsplash.com/photo-1560472354-b33ff0c44a43?q=80&w=800'],
            'notes' => 'Surabaya leadership room.',
        ]);

        Room::create([
            'building_id' => $sh->id,
            'name' => 'Focus 301', 'capacity' => 4, 'floor' => '2F',
            'facilities' => [['name'=>'Whiteboard','icon'=>'border_color'],['name'=>'Wifi','icon'=>'wifi']],
            'photos' => ['https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=800'],
            'notes' => 'Quiet pod for remote work.',
        ]);

        // ── Bookings ─────────────────────────────────────────────────────────
        $today = now()->format('Y-m-d');

        Booking::create(['user_id'=>$admin->id,'room_id'=>$b1->id,'title'=>'Weekly Facility Audit','description'=>'Monthly walkthrough covering all floors.','start_at'=>"{$today} 09:00:00",'end_at'=>"{$today} 10:30:00",'status'=>'confirmed','type'=>'internal']);
        Booking::create(['user_id'=>$user1->id,'room_id'=>$e1->id,'title'=>'Internal Recruitment','description'=>'Panel interview for 2 open positions.','start_at'=>"{$today} 11:00:00",'end_at'=>"{$today} 13:00:00",'status'=>'tentative','type'=>'internal']);
        Booking::create(['user_id'=>$user2->id,'room_id'=>$f1->id,'title'=>'AC Repair','description'=>'Urgent AC repair session.','start_at'=>"{$today} 14:00:00",'end_at'=>"{$today} 16:00:00",'status'=>'confirmed','type'=>'internal']);
        Booking::create(['user_id'=>$admin->id,'room_id'=>$e2->id,'title'=>'Vendor Meeting','description'=>'Q2 procurement discussion.','start_at'=>"{$today} 13:00:00",'end_at'=>"{$today} 14:00:00",'status'=>'confirmed','type'=>'external']);
        Booking::create(['user_id'=>$user1->id,'room_id'=>$b2->id,'title'=>'Budget Review','description'=>'Finance sync Q1 actuals vs forecast.','start_at'=>"{$today} 15:00:00",'end_at'=>"{$today} 16:30:00",'status'=>'confirmed','type'=>'internal']);
        Booking::create(['user_id'=>$admin->id,'room_id'=>$e3->id,'title'=>'Design Sprint','description'=>'UX review session with Creative team.','start_at'=>"{$today} 10:00:00",'end_at'=>"{$today} 12:00:00",'status'=>'confirmed','type'=>'internal']);
        Booking::create(['user_id'=>$user1->id,'room_id'=>$b3->id,'title'=>'Regional Sales Briefing','description'=>'East Java Q2 targets.','start_at'=>"{$today} 09:00:00",'end_at'=>"{$today} 10:00:00",'status'=>'confirmed','type'=>'internal']);
    }
}

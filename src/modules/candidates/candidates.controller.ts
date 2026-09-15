import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CandidatesService } from './candidates.service';
import {
  CandidateQueryDto,
  CreateCandidateDto,
  UpdateCandidateDto,
} from './dto/candidate.dto';

@ApiTags('candidates')
@ApiBearerAuth('access-token')
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly service: CandidatesService) {}

  @Post()
  create(@Body() dto: CreateCandidateDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: CandidateQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCandidateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
